name: 📗 Documentation Issue
description: Tell us if there is missing or incorrect documentation
labels: [docs]
body:
  - type: markdown
    attributes:
      value: |
        Thank you for submitting a documentation request. It helps make Open S2 better.

        The [documentation](https://opens2.com/docs/maps) is still under development. Please report as many issues or missing content requests as you can so we can incoperate that in the new documentation.  
  - type: dropdown
    attributes:
      label: What is the type of issue?
      multiple: true
      options:
        - Documentation is missing
        - Documentation is incorrect
        - Documentation is confusing
        - Example code is not working
        - Something else
  - type: textarea
    attributes:
      label: What is the issue?
    validations:
      required: true
  - type: textarea
    attributes:
      label: Where did you find it?
      description: If possible, please provide the URL(s) where you found this issue.