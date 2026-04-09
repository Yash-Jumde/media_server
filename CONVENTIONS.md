# Project Team Conventions (Multi-Agent System)

This project is developed by a specialized team of AI agents, each with dedicated expertise. This document defines the coordination protocol for Antigravity when adopting these roles.

## Team Structure

1. **Orchestrator** (Default Antigravity): Manages the high-level roadmap, coordinates between agents, and communicates with the user.
2. **Database Architect**: Owns `database/`, SQLite schema, and query logic.
3. **Frontend Visual Designer**: Owns `client/`, CSS architecture, and visual aesthetics.
4. **Backend Engineer**: Owns `server/`, API routes, and media processing logic.

## Coordination Protocol

### 1. Task Assignment
Before starting a task in a specific domain, the **Orchestrator** MUST:
- Read the corresponding agent's `SKILL.md` (e.g., `.antigravity/agents/DatabaseArchitect/SKILL.md`) using `IsSkillFile: true` to adopt the required context and specialized rules.

### 2. Cross-Agent Communication
- If a **Backend Engineer** needs a schema change, they must consult the **Database Architect** definition to ensure standards are met.
- If a **Frontend Designer** needs new API data, they define the required JSON structure for the **Backend Engineer** to implement.

### 3. Standards Enforcement
- **FrontendDesigner**: STRICT "No Emoji" rule. All UI/UX changes must be "Modern Premium".
- **DatabaseArchitect**: All schema changes must be accompanied by a migration plan.
- **BackendEngineer**: Security first (JWT, sanitization).

## File Ownership
- `.antigravity/agents/`: Agent definitions.
- `database/`: Primary domain of Database Architect.
- `client/`: Primary domain of Frontend Visual Designer.
- `server/`: Primary domain of Backend Engineer.

---

*This document is maintained by the Orchestrator.*
