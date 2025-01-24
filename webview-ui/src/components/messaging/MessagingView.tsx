import { VSCodeButton } from "@vscode/webview-ui-toolkit/react"
import styled from "styled-components"

interface MessagingViewProps {
  onDone: () => void
}

const MessagingView = ({ onDone }: MessagingViewProps) => {
  return (
    <Container>
      <Content>
        <Title>Coming Soon</Title>
        <Description>
          Mobile testing and messaging features are under development. Stay tuned for updates!
        </Description>
        <VSCodeButton onClick={onDone}>Close</VSCodeButton>
      </Content>
    </Container>
  )
}

const Container = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--vscode-editor-background);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 100;
`

const Content = styled.div`
  text-align: center;
  padding: 2rem;
`

const Title = styled.h2`
  margin-bottom: 1rem;
  color: var(--vscode-foreground);
`

const Description = styled.p`
  margin-bottom: 2rem;
  color: var(--vscode-foreground);
  opacity: 0.8;
`

export default MessagingView