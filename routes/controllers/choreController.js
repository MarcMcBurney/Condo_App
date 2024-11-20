import * as choreService from "../../services/choreService.js";

const addChore = async ({ request, response }) => {
  const body = request.body({ type: "form" });
  const params = await body.value;

  await choreService.addChore(
    1,
    params.get("title"),
    params.get("description"),
    params.get("chorecoins"),
    params.get("due_date"),
  );

  response.redirect("/chores");
};

const claimChore = async ({ params, response }) => {
  await choreService.claimChore(params.id, 1);

  response.redirect("/chores");
};

const listChores = async ({ render }) => {
  render("chores.eta", {
    availableChores: await choreService.listAvailableChores(),
    claimedChores: await choreService.listUserChores(1),
  });
};

const completeChore = async ({ params, response }) => {
  await choreService.completeChore(params.id, 1);

  response.redirect("/chores");
};

// ...
export { addChore, claimChore, completeChore, listChores };