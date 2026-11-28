import express from "express";

import ViewController from "../controllers/basic_controller/ViewController";

const download = express.Router();

download.get("/windows", ViewController.Download);

export default download;
