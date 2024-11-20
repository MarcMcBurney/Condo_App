import { Router } from "../deps.js";
import * as mainController from "./controllers/mainController.js";
import * as choreController from "./controllers/choreController.js";

const router = new Router();

router.get("/", mainController.showMain);

router.get("/chores", choreController.listChores);
router.post("/chores", choreController.addChore);
router.post("/chores/:id/claim", choreController.claimChore);
router.post("/chores/:id/complete", choreController.completeChore);

export { router };