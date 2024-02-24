# SoP adding chains to UI

1. in the peanut-ui repo, navigate to src/consts/chains.consts.ts
2. import the chain from wagmi/chains 

→ If the chain is importable from wagmi/chains, add it to the const chain at the bottom of the page

→ If the chain is NOT importable from wagmi/chains, you will have to create a custom chain object. To do this, look at the other objects in that file like milkomeda for inspiration, create a custom chain and add it to the const chain at the bottom of the page

notes:

- EVERY chain that is used in the SDK, HAS to be in this file, else wallet interactions will not work.
- it’s okay for chains to be in here, even though they are not supported in the SDK.