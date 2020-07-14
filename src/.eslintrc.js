module.exports = {
    "extends": "react-app",
    "rules" : {
      "no-unused-expressions": [
        "warn",
        {
          allowShortCircuit: true,
          allowTernary: true,
          allowTaggedTemplates: true,
        }
      ]
    }
}
