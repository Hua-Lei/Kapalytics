export {}

declare global {
  interface Window {
    electronAPI: {
      platform: string
      selectPdf: () => Promise<string | null>
    }
  }
}

declare namespace JSX {
  interface IntrinsicElements {
    webview: React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLElement> & {
        src?: string
        ref?: React.Ref<HTMLElement>
      },
      HTMLElement
    >
  }
}
