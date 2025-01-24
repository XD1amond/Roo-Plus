import * as vscode from "vscode"
import { MobileSession } from "../../services/mobile/MobileSession"
import { ClineSayMobileAction, MobileActionResult } from "../../shared/ExtensionMessage"

export class MobileProvider implements vscode.Disposable {
    private static instance: MobileProvider | undefined
    private session: MobileSession
    private outputChannel: vscode.OutputChannel

    constructor(context: vscode.ExtensionContext, outputChannel: vscode.OutputChannel) {
        this.session = new MobileSession(context)
        this.outputChannel = outputChannel
        MobileProvider.instance = this
    }

    static getInstance(): MobileProvider | undefined {
        return MobileProvider.instance
    }

    async handleMobileAction(action: ClineSayMobileAction): Promise<MobileActionResult> {
        this.outputChannel.appendLine(`Handling mobile action: ${action.action}`)

        try {
            switch (action.action) {
                case "launch":
                    if (!action.deviceId) {
                        // If no device ID provided, list available devices
                        const devices = await this.session.listDevices()
                        return {
                            deviceList: devices,
                            logs: "Please select a device by ID from the list above."
                        }
                    }
                    return await this.session.launchDevice(action.deviceId)

                case "tap":
                    if (!action.deviceId || !action.coordinate) {
                        throw new Error("Device ID and coordinate are required for tap action")
                    }
                    const [x, y] = action.coordinate.split(",").map(Number)
                    return await this.session.tap(action.deviceId, x, y)

                case "swipe":
                    if (!action.deviceId || !action.startCoordinate || !action.endCoordinate) {
                        throw new Error("Device ID, start and end coordinates are required for swipe action")
                    }
                    const [startX, startY] = action.startCoordinate.split(",").map(Number)
                    const [endX, endY] = action.endCoordinate.split(",").map(Number)
                    return await this.session.swipe(action.deviceId, startX, startY, endX, endY, action.duration)

                case "type":
                    if (!action.deviceId || !action.text) {
                        throw new Error("Device ID and text are required for type action")
                    }
                    return await this.session.type(action.deviceId, action.text)

                case "rotate":
                    if (!action.deviceId || !action.orientation) {
                        throw new Error("Device ID and orientation are required for rotate action")
                    }
                    return await this.session.rotate(action.deviceId, action.orientation)

                case "close":
                    if (!action.deviceId) {
                        throw new Error("Device ID is required for close action")
                    }
                    return await this.session.closeDevice(action.deviceId)

                default:
                    throw new Error(`Unknown mobile action: ${(action as any).action}`)
            }
        } catch (error) {
            this.outputChannel.appendLine(`Mobile action error: ${error.message}`)
            throw error
        }
    }

    async cleanup() {
        // Close all active device sessions
        const devices = await this.session.listDevices()
        await Promise.all(devices.map(device => 
            this.session.closeDevice(device.id).catch(() => {})
        ))
    }

    dispose() {
        this.outputChannel.appendLine("Disposing MobileProvider...")
        this.cleanup().catch(error => {
            this.outputChannel.appendLine(`Error during cleanup: ${error}`)
        })
        MobileProvider.instance = undefined
    }
}