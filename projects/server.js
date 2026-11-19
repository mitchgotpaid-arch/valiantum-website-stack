const { createApp } = require("./app");

// Hostinger loads the entry file as a module, so startup must be unconditional.
  createApp()
    .then(({ app }) => {
      const server=app.listen(process.env.PORT || 3001, () => {
        console.log("Valiantum Projects ready");
        const stop=require('./agent-worker.cjs').startAgentWorker(process.env,server.address().port);
        server.once('close',stop);
      });
    })
    .catch((e) => {
      console.error(e.message);
      process.exit(1);
    });
