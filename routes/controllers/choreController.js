import * as choreService from "../../services/choreService.js";

const addChore = async ({ request, response, user }) => {
  const body = request.body({ type: "form" });
  const params = await body.value;

  await choreService.addChore(
    user.id,
    params.get("title"),
    params.get("description"),
    params.get("chorecoins"),
    params.get("due_date"),
  );

  response.redirect("/chores");
};

const claimChore = async ({ params, response, user }) => {
  await choreService.claimChore(params.id, user.id);

  response.redirect("/chores");
};

const completeChore = async ({ params, response, user }) => {
  await choreService.completeChore(params.id, user.id);

  response.redirect("/chores");
};

const listChores = async ({ render, user }) => {
  render("chores.eta", {
    availableChores: await choreService.listAvailableChores(),
    claimedChores: await choreService.listUserChores(user.id),
  });
};

export { addChore, claimChore, completeChore, listChores };