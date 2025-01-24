import * as vscode from "vscode"
import { MobileActionResult } from "../../shared/ExtensionMessage"
import { execSync, spawn } from "child_process"
import { promisify } from "util"
import { fileExistsAtPath } from "../../utils/fs"
import delay from "delay"
import pWaitFor from "p-wait-for"
import { promises as fs } from "fs"
import * as path from "path"
import { tmpdir } from "os"

const exec = promisify(require("child_process").exec)

const SCREENSHOT_TIMEOUT = 10000 // 10 seconds
const DEVICE_BOOT_TIMEOUT = 30000 // 30 seconds
const LOG_SETTLE_TIMEOUT = 3000 // 3 seconds
const LOG_CHECK_INTERVAL = 100 // 100ms

interface DeviceInfo {
    id: string
    name: string
    platform: "ios" | "android"
    status: string
}

interface DeviceSession {
    device: DeviceInfo
    logProcess: any
    lastLogTs: number
    logs: string[]
}

export class MobileSession {
    private context: vscode.ExtensionContext
    private deviceSessions = new Map<string, DeviceSession>()

    constructor(context: vscode.ExtensionContext) {
        this.context = context
    }

    private async ensureSimulatorExists(): Promise<void> {
        // Check if Xcode is installed (for iOS)
        try {
            execSync("xcode-select -p")
        } catch {
            throw new Error("Xcode not found. Please install Xcode for iOS testing.")
        }

        // Check if Android SDK is installed
        const androidHome = process.env.ANDROID_HOME
        if (!androidHome || !await fileExistsAtPath(androidHome)) {
            throw new Error("Android SDK not found. Please install Android SDK for Android testing.")
        }
    }

    async listDevices(): Promise<DeviceInfo[]> {
        await this.ensureSimulatorExists()
        return this.getAvailableDevices()
    }

    private async getAvailableDevices(): Promise<DeviceInfo[]> {
        const devices: DeviceInfo[] = []

        // Get iOS simulators
        try {
            const { stdout: xcrunOutput } = await exec("xcrun simctl list devices available --json")
            const simulators = JSON.parse(xcrunOutput).devices
            
            for (const runtime of Object.keys(simulators)) {
                for (const device of simulators[runtime]) {
                    if (device.isAvailable) {
                        devices.push({
                            id: device.udid,
                            name: device.name,
                            platform: "ios",
                            status: device.state
                        })
                    }
                }
            }
        } catch (error) {
            console.error("Error getting iOS simulators:", error)
        }

        // Get Android emulators
        try {
            const { stdout: adbOutput } = await exec("adb devices -l")
            const lines = adbOutput.split("\n").slice(1)
            
            for (const line of lines) {
                const match = line.match(/^(\S+)\s+device\s+(.*)$/)
                if (match) {
                    const [, id, info] = match
                    const nameMatch = info.match(/model:(\S+)/)
                    devices.push({
                        id,
                        name: nameMatch ? nameMatch[1] : id,
                        platform: "android",
                        status: "device"
                    })
                }
            }
        } catch (error) {
            console.error("Error getting Android emulators:", error)
        }

        return devices
    }

    async launchDevice(deviceId: string): Promise<MobileActionResult> {
        // Check if device exists
        const devices = await this.getAvailableDevices()
        const device = devices.find(d => d.id === deviceId)
        if (!device) {
            throw new Error(`Device with ID ${deviceId} not found`)
        }

        // Close existing session if it exists
        if (this.deviceSessions.has(deviceId)) {
            await this.closeDevice(deviceId)
        }

        // Create new session first
        this.deviceSessions.set(deviceId, {
            device,
            logProcess: null,
            lastLogTs: Date.now(),
            logs: []
        })

        try {
            // Launch device
            if (device.platform === "ios") {
                await exec(`xcrun simctl boot ${device.id}`)
                // Start log collection
                const logProcess = spawn("xcrun", ["simctl", "log", device.id])
                this.setupLogHandlers(device.id, logProcess)
            } else {
                // For Android, we need to ensure the emulator is running first
                await exec(`${process.env.ANDROID_HOME}/emulator/emulator -avd ${device.name} -no-snapshot-load &`)
                
                // Wait for device to be ready
                await pWaitFor(async () => {
                    const { stdout } = await exec("adb devices")
                    return stdout.includes(device.id)
                }, { timeout: DEVICE_BOOT_TIMEOUT, interval: 1000 })

                // Start log collection
                const logProcess = spawn("adb", ["logcat"])
                this.setupLogHandlers(device.id, logProcess)
            }

            // Wait for device to fully boot
            await delay(5000)

            return this.captureDeviceState(deviceId)
        } catch (error) {
            // Clean up session on error
            this.deviceSessions.delete(deviceId)
            throw error
        }
    }

    private setupLogHandlers(deviceId: string, logProcess: any) {
        const session = this.deviceSessions.get(deviceId)
        if (!session) return

        session.logProcess = logProcess

        logProcess.stdout.on("data", (data: Buffer) => {
            const log = data.toString()
            session.logs.push(log)
            session.lastLogTs = Date.now()
        })

        logProcess.stderr.on("data", (data: Buffer) => {
            const log = `[Error] ${data.toString()}`
            session.logs.push(log)
            session.lastLogTs = Date.now()
        })
    }

    async closeDevice(deviceId: string): Promise<MobileActionResult> {
        const session = this.deviceSessions.get(deviceId)
        if (!session) return {}

        const errors: string[] = []

        try {
            // Kill log process if it exists
            if (session.logProcess) {
                session.logProcess.kill()
                await new Promise(resolve => setTimeout(resolve, 500)) // Wait for process to exit
            }

            // Shutdown device
            if (session.device.platform === "ios") {
                try {
                    await exec(`xcrun simctl shutdown ${session.device.id}`)
                } catch (error) {
                    // Device might already be shutdown
                    if (!error.message.includes("Unable to shutdown device in current state")) {
                        throw error
                    }
                }
            } else {
                // For Android, try both methods
                try {
                    await exec(`adb -s ${session.device.id} emu kill`)
                } catch {
                    try {
                        await exec(`${process.env.ANDROID_HOME}/platform-tools/adb -s ${session.device.id} emu kill`)
                    } catch (error) {
                        errors.push(`Failed to kill Android emulator: ${error.message}`)
                    }
                }
            }
        } catch (error) {
            errors.push(`Error during device shutdown: ${error.message}`)
        } finally {
            // Always clean up the session
            this.deviceSessions.delete(deviceId)
        }

        return {
            logs: errors.length > 0 ? errors.join("\n") : "Device closed successfully"
        }
    }

    private async doAction(deviceId: string, action: () => Promise<void>): Promise<MobileActionResult> {
        const session = this.deviceSessions.get(deviceId)
        if (!session) {
            throw new Error(`No active session for device ${deviceId}`)
        }

        try {
            await action()
            
            // Wait for log inactivity
            await pWaitFor(() => Date.now() - session.lastLogTs >= LOG_CHECK_INTERVAL, {
                timeout: LOG_SETTLE_TIMEOUT,
                interval: LOG_CHECK_INTERVAL,
            }).catch(() => {
                session.logs.push("[Warning] Timed out waiting for logs to settle")
            })

            return this.captureDeviceState(deviceId)
        } catch (err) {
            session.logs.push(`[Error] ${err.toString()}`)
            // Still try to capture device state even if action failed
            return this.captureDeviceState(deviceId)
        }
    }

    private async captureDeviceState(deviceId: string): Promise<MobileActionResult> {
        const session = this.deviceSessions.get(deviceId)
        if (!session) return {}

        let screenshot: string | undefined
        const tempPath = path.join(tmpdir(), `device-${deviceId}-${Date.now()}.png`)

        try {
            // Set up a timeout for the screenshot operation
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error("Screenshot capture timed out")), SCREENSHOT_TIMEOUT)
            })

            const capturePromise = (async () => {
                if (session.device.platform === "ios") {
                    await exec(`xcrun simctl io ${session.device.id} screenshot ${tempPath} --type=png --mask=ignored`)
                } else {
                    await exec(`adb -s ${session.device.id} exec-out screencap -p > ${tempPath}`)
                }

                // Read the screenshot file and convert to base64
                const imageBuffer = await fs.readFile(tempPath)
                return `data:image/png;base64,${imageBuffer.toString("base64")}`
            })()

            // Race between the capture operation and timeout
            screenshot = await Promise.race([capturePromise, timeoutPromise]) as string
        } catch (error) {
            session.logs.push(`[Screenshot Error] ${error.toString()}`)
        } finally {
            // Clean up temp file
            await fs.unlink(tempPath).catch(() => {})
        }

        return {
            screenshot,
            logs: session.logs.join("\n"),
            deviceInfo: {
                id: session.device.id,
                name: session.device.name,
                platform: session.device.platform
            }
        }
    }

    async tap(deviceId: string, x: number, y: number): Promise<MobileActionResult> {
        return this.doAction(deviceId, async () => {
            const session = this.deviceSessions.get(deviceId)
            if (!session) return

            if (session.device.platform === "ios") {
                await exec(`xcrun simctl io ${session.device.id} tap ${x} ${y}`)
            } else {
                await exec(`adb -s ${session.device.id} shell input tap ${x} ${y}`)
            }
            await delay(500)
        })
    }

    async swipe(deviceId: string, startX: number, startY: number, endX: number, endY: number, duration: number = 300): Promise<MobileActionResult> {
        return this.doAction(deviceId, async () => {
            const session = this.deviceSessions.get(deviceId)
            if (!session) return

            if (session.device.platform === "ios") {
                await exec(`xcrun simctl io ${session.device.id} drag ${startX} ${startY} ${endX} ${endY} ${duration}`)
            } else {
                await exec(`adb -s ${session.device.id} shell input swipe ${startX} ${startY} ${endX} ${endY} ${duration}`)
            }
            await delay(500)
        })
    }

    async rotate(deviceId: string, orientation: "portrait" | "landscape"): Promise<MobileActionResult> {
        return this.doAction(deviceId, async () => {
            const session = this.deviceSessions.get(deviceId)
            if (!session) return

            if (session.device.platform === "ios") {
                await exec(`xcrun simctl orientation ${session.device.id} ${orientation}`)
            } else {
                const rotation = orientation === "portrait" ? 0 : 1
                await exec(`adb -s ${session.device.id} shell settings put system user_rotation ${rotation}`)
            }
            await delay(1000)
        })
    }

    async type(deviceId: string, text: string): Promise<MobileActionResult> {
        return this.doAction(deviceId, async () => {
            const session = this.deviceSessions.get(deviceId)
            if (!session) return

            if (session.device.platform === "ios") {
                await exec(`xcrun simctl keyboard ${session.device.id} type "${text}"`)
            } else {
                await exec(`adb -s ${session.device.id} shell input text "${text.replace(/\s/g, "%s")}"`)
            }
            await delay(300)
        })
    }
}