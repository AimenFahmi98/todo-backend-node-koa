const router = require("koa-router")();

const Koa = require("koa");
const bodyParser = require("koa-bodyparser");
const cors = require("@koa/cors");
const mongoose = require("mongoose");
const dotenv = require("dotenv");

const app = new Koa();

dotenv.config({ path: "./config.env" });

const {
  env: { UNAME, PASSWORD, HOST, DATABASE, CONNECTION_STRING, PORT },
} = process;

const DB_CONNECTION = CONNECTION_STRING.replace("<UNAME>", UNAME)
  .replace("<PASSWORD>", PASSWORD)
  .replace("<HOST>", HOST)
  .replace("<DATABASE>", DATABASE);

mongoose.connect(DB_CONNECTION, {}).then(() => {
  console.log("DB connection successful.");
});

const todoSchema = mongoose.Schema({
  id: Number,
  title: String,
  order: Number,
  completed: Boolean,
  url: String,
});

const Todo = mongoose.model("Todo", todoSchema);

let todos = {
  0: { title: "build an API", order: 1, completed: false },
  1: { title: "?????", order: 2, completed: false },
  2: { title: "profit!", order: 3, completed: false },
};
let nextId = 3;

router
  .get("/todos/", list)
  .del("/todos/", clear)
  .post("/todos/", add)
  .get("todo", "/todos/:id", show)
  .patch("/todos/:id", update)
  .del("/todos/:id", remove);

async function list(ctx) {
  ctx.body = Object.keys(todos).map((k) => {
    todos[k].id = k;
    return todos[k];
  });
}

async function clear(ctx) {
  todos = {};
  ctx.status = 204;
}

async function add(ctx) {
  const todo = ctx.request.body;
  if (!todo.title) ctx.throw(400, { error: '"title" is a required field' });
  const title = todo.title;
  if (!typeof data === "string" || !title.length)
    ctx.throw(400, {
      error: '"title" must be a string with at least one character',
    });

  todo["completed"] = todo["completed"] || false;
  todo["url"] = "http://" + ctx.host + router.url("todo", nextId);
  todos[nextId++] = todo;

  ctx.status = 303;
  ctx.set("Location", todo["url"]);
}

async function show(ctx) {
  const id = ctx.params.id;
  const todo = todos[id];
  if (!todo) ctx.throw(404, { error: "Todo not found" });
  todo.id = id;
  ctx.body = todo;
}

async function update(ctx) {
  const id = ctx.params.id;
  const todo = todos[id];

  Object.assign(todo, ctx.request.body);

  ctx.body = todo;
}

async function remove(ctx) {
  const id = ctx.params.id;
  if (!todos[id]) ctx.throw(404, { error: "Todo not found" });

  delete todos[id];

  ctx.status = 204;
}

app
  .use(bodyParser())
  .use(cors())
  .use(router.routes())
  .use(router.allowedMethods());

app.listen(8080);
