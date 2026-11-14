const fs = require("node:fs/promises");
const path = require("node:path");
async function createStore(env) {
  if (env.MYSQL_HOST) {
    const mysql = require("mysql2/promise");
    const pool = mysql.createPool({
      host: env.MYSQL_HOST,
      port: Number(env.MYSQL_PORT || 3306),
      user: env.MYSQL_USER,
      password: env.MYSQL_PASSWORD,
      database: env.MYSQL_DATABASE,
      connectionLimit: 3,
      ...(env.MYSQL_SSL === "true"
        ? { ssl: { rejectUnauthorized: true } }
        : {}),
    });
    await pool.execute(
      "CREATE TABLE IF NOT EXISTS valiantum_projects (id INT PRIMARY KEY, revision INT NOT NULL, document LONGTEXT NOT NULL)",
    );
    await pool.execute(
      "INSERT IGNORE INTO valiantum_projects (id,revision,document) VALUES (1,0,?)",
      [JSON.stringify({ projects: [] })],
    );
    return {
      async read() {
        const [rows] = await pool.execute(
          "SELECT revision,document FROM valiantum_projects WHERE id=1",
        );
        return { ...JSON.parse(rows[0].document), revision: rows[0].revision };
      },
      async write(data, revision) {
        const [result] = await pool.execute(
          "UPDATE valiantum_projects SET document=?,revision=revision+1 WHERE id=1 AND revision=?",
          [JSON.stringify(data), revision],
        );
        return result.affectedRows === 1;
      },
      close: () => pool.end(),
    };
  }
  if (env.NODE_ENV === "production")
    throw new Error(
      "MySQL is required in production. Configure MYSQL_HOST, MYSQL_USER, MYSQL_PASSWORD and MYSQL_DATABASE.",
    );
  const file = path.resolve(
    env.PROJECTS_DATA_FILE || path.join(__dirname, "data", "workspace.json"),
  );
  await fs.mkdir(path.dirname(file), { recursive: true });
  let data;
  try {
    data = JSON.parse(await fs.readFile(file, "utf8"));
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
    data = { projects: [], revision: 0 };
  }
  return {
    async read() {
      return structuredClone(data);
    },
    async write(next, revision) {
      if (data.revision !== revision) return false;
      const updated = { ...next, revision: revision + 1 };
      await fs.writeFile(file + ".tmp", JSON.stringify(updated), {
        mode: 0o600,
      });
      await fs.rename(file + ".tmp", file);
      data = updated;
      return true;
    },
    async close() {},
  };
}
module.exports = { createStore };
