# Architecture Review Checklist

1. Does each changed file have one responsibility?
2. Are external systems behind interfaces/adapters?
3. Are policies centralized and reusable?
4. Can runtime/provider selection be changed without workflow rewrites?
5. Are test files covering each new service/policy boundary?
6. Does any file exceed ~300 logical lines and need splitting?
