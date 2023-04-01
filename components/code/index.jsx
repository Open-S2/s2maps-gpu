// @flow
/* MODULES */
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
/* STYLES */
import darkStyle from './dark.js'
import lightStyle from './light.js'
import styles from '../../styles/Code.module.css'

export default function Code ({ showLineNumbers, language, code, light }) {
  return (
    <div style={{ backgroundColor: light ? '#f5faff' : '#383B43' }} className={styles.codeBlock}>
      <SyntaxHighlighter showLineNumbers={showLineNumbers} language={language} style={light ? lightStyle : darkStyle}>
        {code}
      </SyntaxHighlighter>
    </div>
  )
}
