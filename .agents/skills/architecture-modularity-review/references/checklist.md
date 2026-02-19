# Architecture Review Checklist

1. Does each changed file have one responsibility?
2. Are external systems behind interfaces/adapters?
3. Are policies centralized and reusable?
4. Can runtime/provider selection be changed without workflow rewrites?
5. Are test files covering each new service/policy boundary?
6. Does any file exceed ~300 logical lines and need splitting?
7. Does any non-test source file exceed the 400-line hard cap? If yes, split now or create explicit refactor follow-up.
8. If a carve-out file was touched, did the PR reduce or at least not expand its responsibility surface?
