const express = require("express");
const router = express.Router();

const {
    createIntersection,
    getAllIntersections,
    getIntersection
} = require("../controllers/intersection.controller");

router.post("/", createIntersection);
router.get("/", getAllIntersections);
router.get("/:id", getIntersection);

module.exports = router;
