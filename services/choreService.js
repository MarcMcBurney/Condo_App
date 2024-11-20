import { sql } from "../database/database.js";

const addChore = async (userId, title, description, chorecoins, dueDate) => {
  await sql`INSERT INTO chores
      (user_id, title, description, chorecoins, due_date)
        VALUES (${userId}, ${title}, ${description}, ${chorecoins}, ${dueDate})`;
};

const claimChore = async (choreId, userId) => {
  await sql`INSERT INTO chore_assignments
    (chore_id, user_id, created_at) VALUES
      (${choreId}, ${userId}, NOW())`;
};

const listChores = async () => {
  const rows = await sql`SELECT * FROM chores
      WHERE (due_date IS NULL OR due_date > NOW())`;

  return rows;
};

export { addChore, claimChore, listChores };