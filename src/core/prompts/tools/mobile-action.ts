import { ToolArgs } from "./types"

export function getMobileActionDescription(_args: ToolArgs): string {
    return `## mobile_action
Description: Request to interact with a mobile device emulator. Every action will be responded to with a screenshot of the device's current state, along with any new console logs. You may only perform one mobile action per message, and wait for the user's response including a screenshot and logs to determine the next action.

Parameters:
- action: (required) The action to perform. The available actions are:
    * launch: Launch a device emulator. If no deviceId is provided, returns a list of available devices.
        - Use with \`deviceId\` to specify a particular device
        - Optionally use \`platform\` and \`deviceName\` to help identify devices
    * tap: Tap at a specific x,y coordinate.
        - Requires \`deviceId\` to specify which device to control
        - Use with the \`coordinate\` parameter to specify the location.
        - Always tap in the center of an element based on coordinates derived from a screenshot.
    * swipe: Swipe from one coordinate to another.
        - Requires \`deviceId\` to specify which device to control
        - Use with \`startCoordinate\` and \`endCoordinate\` parameters.
        - Optionally use \`duration\` (in milliseconds) to control swipe speed.
    * type: Type a string of text on the keyboard.
        - Requires \`deviceId\` to specify which device to control
        - Use with the \`text\` parameter to provide the string to type.
    * rotate: Rotate the device orientation.
        - Requires \`deviceId\` to specify which device to control
        - Use with the \`orientation\` parameter set to either "portrait" or "landscape".
    * close: Close the specified device emulator.
        - Requires \`deviceId\` to specify which device to close
- deviceId: (required except for initial launch) The ID of the device to control.
- platform: (optional) The platform type, either "ios" or "android".
- deviceName: (optional) The name of the specific device.
- coordinate: (optional) The X and Y coordinates for the \`tap\` action.
- startCoordinate: (optional) The starting X and Y coordinates for the \`swipe\` action.
- endCoordinate: (optional) The ending X and Y coordinates for the \`swipe\` action.
- duration: (optional) The duration in milliseconds for the \`swipe\` action.
- text: (optional) The text to type for the \`type\` action.
- orientation: (optional) The orientation for the \`rotate\` action ("portrait" or "landscape").

Usage:
<mobile_action>
<action>Action to perform (e.g., launch, tap, swipe, type, rotate, close)</action>
<deviceId>Device ID (required except for initial launch)</deviceId>
<platform>ios or android (optional)</platform>
<deviceName>Device name (optional)</deviceName>
<coordinate>x,y coordinates (optional)</coordinate>
<startCoordinate>x,y coordinates (optional)</startCoordinate>
<endCoordinate>x,y coordinates (optional)</endCoordinate>
<duration>Duration in milliseconds (optional)</duration>
<text>Text to type (optional)</text>
<orientation>portrait or landscape (optional)</orientation>
</mobile_action>

Example: Requesting to list available devices
<mobile_action>
<action>launch</action>
</mobile_action>

Example: Requesting to launch a specific device
<mobile_action>
<action>launch</action>
<deviceId>00008030-000D24C13453402E</deviceId>
</mobile_action>

Example: Requesting to tap at coordinates on a specific device
<mobile_action>
<action>tap</action>
<deviceId>00008030-000D24C13453402E</deviceId>
<coordinate>200,300</coordinate>
</mobile_action>`
}