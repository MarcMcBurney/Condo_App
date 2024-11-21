import { sql } from "../database/database.js";

const findFiveUsersWithMostCreatedChores = async () => {
  const rows = await sql`SELECT users.name as name, count(*) as count FROM users
    JOIN chores ON users.id = chores.user_id
    GROUP BY users.name
    ORDER BY count
    LIMIT 5`;

  return rows;
};

export { findFiveUsersWithMostCreatedChores };