<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep new VM-only database changes in docker/migrations and apply both migration directories in timestamp order with scripts/atualizar-vm.sh; the local VM is the database authority.
- Represent B2B work orders in solicitacoes with structured dados and cliente_id; this preserves the existing request lifecycle and history.
- Record OS material consumption through registrar_materiais_os with a session-derived owner, row locks and an idempotency UUID; stock and audit records must commit together.
- Test inventory SQL in isolated PGlite with auth/RLS fixtures; this validates rules without accessing the user's VM.
- Extend generated database types for VM-only tables in estoque-client.ts instead of editing generated files; the editor schema does not manage the self-hosted database.
- Each content route supplies unique metadata through its own head; use pageHead for shared metadata shape without moving leaf titles to the root.
