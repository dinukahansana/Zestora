# n8n setup

n8n will run Zestora workflows. A workflow is a sequence of steps. Each node performs one action. A trigger starts the workflow, such as a schedule or a signed HTTP request to a webhook.

## Integration milestone

1. Choose a hosted or self-hosted n8n instance and configure its HTTPS access.
2. Add provider credentials in n8n's credential store or configure secure environment variables.
3. Import documented workflow exports from `automation/workflows`. Connect their required credentials and settings.
4. Send a synthetic payload from `automation/examples` using the documented signature and timestamp.
5. Use execution history to inspect input validation, dispatch, and retries. Check duplicate delivery and simulated provider failure before enabling a workflow.
6. Export the verified workflow without secrets and record the instance behavior in the testing notes.

See [the automation specification](AI_AUTOMATION_SPECIFICATION.md) for workflow names and event requirements. Phase 0 establishes the directory structure. Instance setup and workflow verification are pending.
