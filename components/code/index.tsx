/* MODULES */
import React from 'react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
/* STYLES */
import darkStyle from './dark.js'
import lightStyle from './light.js'
import styles from '../../styles/Code.module.css'

import type { CSSProperties } from 'react'

export default function Code ({ showLineNumbers, language, code, light }: {
  showLineNumbers: boolean
  language: string
  code: string
  light: boolean
}): React.JSX.Element {
  return (
    <div style={{ backgroundColor: light ? '#f5faff' : '#383B43' }} className={styles.codeBlock}>
      <SyntaxHighlighter showLineNumbers={showLineNumbers} language={language} style={(light ? lightStyle : darkStyle) as Record<string, CSSProperties>}>
        {code}
      </SyntaxHighlighter>
    </div>
  )
}
