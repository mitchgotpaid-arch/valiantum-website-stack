const { createApp } = require("./app");

// Hostinger loads the entry file as a module, so startup must be unconditional.
  createApp()
    .then(({ app }) =>
      app.listen(process.env.PORT || 3001, () =>
        console.log("Valiantum Projects ready"),
      ),
    )
    .catch((e) => {
      console.error(e.message);
      process.exit(1);
    });
