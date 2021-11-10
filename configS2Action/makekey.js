const { context } = require('@actions/github')
const { join } = require('path')

const makeKey = ({ key, root = '' }) => {
  return join(
    root,
    context.payload.repository.full_name || '',
    context.sha,
    key
  )
}

exports.makeKey = makeKey
