import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ClineMessage, ClineSayMobileAction } from "../../../../src/shared/ExtensionMessage"
import { ChatRowContent } from "./ChatRow"
import { ChatRowContainer, ChatRowHeader } from "./styles"

interface MobileSessionRowProps {
	messages: ClineMessage[]
	isLast: boolean
	lastModifiedMessage: ClineMessage | undefined
	onHeightChange: (isTaller: boolean) => void
	isStreaming: boolean
	isExpanded: (ts: number) => boolean
	onToggleExpand: (ts: number) => void
}

const MobileSessionRow = ({
	messages,
	isLast,
	lastModifiedMessage,
	onHeightChange,
	isStreaming,
	isExpanded,
	onToggleExpand,
}: MobileSessionRowProps) => {
	const containerRef = useRef<HTMLDivElement>(null)
	const [prevHeight, setPrevHeight] = useState<number>()

	useEffect(() => {
		const height = containerRef.current?.getBoundingClientRect().height
		if (height !== undefined && prevHeight !== undefined) {
			onHeightChange(height > prevHeight)
		}
		setPrevHeight(height)
	}, [messages, prevHeight, onHeightChange])

	const handleToggleExpand = useCallback(
		(ts: number) => {
			onToggleExpand(ts)
		},
		[onToggleExpand],
	)

	const firstMessage = messages[0]
	const lastMessage = messages[messages.length - 1]

	const mobileAction = useMemo(() => {
		try {
			if (firstMessage?.text) {
				const parser = new DOMParser()
				const xmlDoc = parser.parseFromString(firstMessage.text, "text/xml")
				return {
					action: xmlDoc.querySelector("action")?.textContent as any,
					deviceId: xmlDoc.querySelector("deviceId")?.textContent || undefined,
					platform: xmlDoc.querySelector("platform")?.textContent as any || undefined,
					deviceName: xmlDoc.querySelector("deviceName")?.textContent || undefined,
					coordinate: xmlDoc.querySelector("coordinate")?.textContent || undefined,
					startCoordinate: xmlDoc.querySelector("startCoordinate")?.textContent || undefined,
					endCoordinate: xmlDoc.querySelector("endCoordinate")?.textContent || undefined,
					duration: xmlDoc.querySelector("duration")?.textContent ? parseInt(xmlDoc.querySelector("duration")?.textContent || "0") : undefined,
					text: xmlDoc.querySelector("text")?.textContent || undefined,
					orientation: xmlDoc.querySelector("orientation")?.textContent as any || undefined
				} as ClineSayMobileAction
			}
		} catch (error) {
			console.error("Failed to parse mobile action:", error)
		}
		return undefined
	}, [firstMessage])

	return (
		<ChatRowContainer ref={containerRef} isLast={isLast}>
			<ChatRowHeader>
				<span
					className="codicon codicon-device-mobile"
					style={{ color: "var(--vscode-foreground)", marginBottom: "-1.5px" }}
				/>
				<span style={{ color: "var(--vscode-foreground)", fontWeight: "bold" }}>
					Mobile Action: {mobileAction?.action}
				</span>
			</ChatRowHeader>
			{messages.map((message) => (
				<ChatRowContent
					key={message.ts}
					message={message}
					isExpanded={isExpanded(message.ts)}
					onToggleExpand={() => handleToggleExpand(message.ts)}
					isLast={message === lastMessage}
					lastModifiedMessage={lastModifiedMessage}
					isStreaming={isStreaming}
				/>
			))}
		</ChatRowContainer>
	)
}

export default MobileSessionRow