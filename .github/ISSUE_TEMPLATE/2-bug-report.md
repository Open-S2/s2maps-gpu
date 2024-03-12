name: 🐛 Bug Report
description: Report an issue that should be fixed
labels: [bug]
body:
  - type: markdown
    attributes:
      value: |
        Thank you for submitting a bug report. It helps make Open S2 better.

        If you need help or support using the s2maps-gpu engine, and are not reporting a bug, please join our [Discord](https://discord.opens2.com) server.

        Please try to include as much information as possible.

  - type: input
    attributes:
      label: What browser are you using?
      description: |
        For example, Chrome, Firefox, Safari, Edge, etc.
    validations:
        required: true
  - type: input
    attributes:
      label: What version of the browser are you using?
      description: |
        For example, 89.0.4389.82
    validations:
        required: true
  - type: textarea
    attributes:
      label: What steps can reproduce the bug?
      description: Explain the bug and provide a code snippet that can reproduce it.
    validations:
      required: true
  - type: textarea
    attributes:
      label: What is the expected behavior?
      description: If possible, please provide text instead of a screenshot.
  - type: textarea
    attributes:
      label: What do you see instead?
      description: If possible, please provide text instead of a screenshot.
  - type: textarea
    attributes:
      label: Additional information
      description: Is there anything else you think we should know?
