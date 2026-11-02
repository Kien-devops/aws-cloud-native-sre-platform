# Reliability reports

`generate.py` renders Markdown from measured JSON evidence. Missing fields remain `NOT_MEASURED`; the tool never invents runtime values.

Example:

```powershell
python .\sre\reliability-reports\generate.py evidence.json report.md
```
