'use strict'

module.exports = function (base64Data) {
  const binary = atob(base64Data)
  const bytes = new Uint8Array(binary.length)

  for (let i = 0; i < binary.length; ++i) {
    bytes[i] = binary.charCodeAt(i)
  }

  return bytes.buffer
}
