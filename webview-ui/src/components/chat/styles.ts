import styled from "styled-components"

export const ChatRowContainer = styled.div<{ isLast: boolean }>`
  padding: 10px 6px 10px 15px;
  ${(props) => !props.isLast && "border-bottom: 1px solid var(--vscode-editorGroup-border);"}
`

export const ChatRowHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
`