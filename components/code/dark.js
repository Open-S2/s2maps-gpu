export default {
  'code[class*="language-"]': {
    color: '#e0ded5',
    background: 'none',
    fontFamily: '\'Cascadia Code Web\', Consolas, Monaco, \'Andale Mono\', \'Ubuntu Mono\', monospace',
    fontSize: '1em',
    textAlign: 'left',
    whiteSpace: 'pre',
    wordSpacing: 'normal',
    wordBreak: 'normal',
    wordWrap: 'normal',
    lineHeight: '1.6',
    MozTabSize: '4',
    OTabSize: '4',
    tabSize: '4',
    WebkitHyphens: 'none',
    MozHyphens: 'none',
    msHyphens: 'none',
    hyphens: 'none'
  },
  'pre[class*="language-"]': {
    color: '#e0ded5',
    'font-family': '\'Cascadia Code Web\', Consolas, Monaco, \'Andale Mono\', \'Ubuntu Mono\', monospace',
    fontFamily: "'Cascadia Code Web', Consolas, Monaco, 'Andale Mono', 'Ubuntu Mono', monospace",
    fontSize: '1em',
    textAlign: 'left',
    whiteSpace: 'pre',
    wordSpacing: 'normal',
    wordBreak: 'normal',
    wordWrap: 'normal',
    lineHeight: '1.5',
    MozTabSize: '4',
    OTabSize: '4',
    tabSize: '4',
    WebkitHyphens: 'none',
    MozHyphens: 'none',
    msHyphens: 'none',
    hyphens: 'none',
    padding: '1em',
    margin: '.5em 0',
    overflow: 'auto',
    background: 'none'
  },

  /* Code blocks */

  ':not(pre) > code[class*=\'language-\']': {
    background: 'none',
    padding: '0.1em',
    'border-radius': '0.3em',
    'white-space': 'normal'
  },

  /* Inline code */

  comment: {
    color: '#8292a2'
  },
  prolog: {
    color: '#8292a2'
  },
  doctype: {
    color: '#8292a2'
  },
  cdata: {
    color: '#8292a2'
  },

  punctuation: {
    color: '#e0ded5'
  },

  namespace: {
    color: '#e0ded5'
  },

  property: {
    color: '#8cc9ea'
  },
  tag: {
    color: '#e2c583'
  },
  constant: {
    color: '#989fea'
  },
  symbol: {
    color: '#989fea'
  },
  deleted: {
    color: '#989fea'
  },

  boolean: {
    color: '#989fea'
  },
  number: {
    color: '#989fea'
  },

  selector: {
    color: '#ce8096'
  },
  'attr-name': {
    color: '#8bb7a9'
  },
  string: {
    color: '#8bb7a9'
  },
  char: {
    color: '#8bb7a9'
  },
  builtin: {
    color: '#8bb7a9'
  },
  inserted: {
    color: '#8bb7a9'
  },

  operator: {
    color: '#f8f8f2'
  },
  entity: {
    color: '#f8f8f2',
    cursor: 'help'
  },
  url: {
    color: '#f8f8f2'
  },
  variable: {
    color: '#e2c583'
  },

  atrule: {
    color: '#e6db74'
  },
  'attr-value': {
    color: '#e8dab8'
  },
  function: {
    color: '#ce8096'
  },
  'class-name': {
    color: '#ce8096'
  },

  keyword: {
    color: '#8cc9ea'
  },

  regex: {
    color: '#e2c583'
  },
  important: {
    color: '#e2c583',
    'font-weight': 'bold'
  },

  bold: {
    'font-weight': 'bold'
  },
  italic: {
    'font-style': 'italic'
  }
}
