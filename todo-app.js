const router = require("koa-router")();

const Koa = require("koa");
const bodyParser = require("koa-bodyparser");
const cors = require("@koa/cors");
const mongoose = require("mongoose");

const app = new Koa();

try {
  mongoose
    .connect("mongodb+srv://aimen:012345@cluster0.l6r9jrm.mongodb.net/", {})
    .then(() => {
      console.log("DB connection successful.");
    });
} catch (err) {
  console.log(`Problem connecting to database: ${err}`);
}

const todoSchema = mongoose.Schema({
  id: {
    type: String,
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  order: {
    type: Number,
    default: function () {
      return this.id;
    },
  },
  completed: {
    type: Boolean,
    default: false,
  },
  url: String,
});

const Todos = mongoose.model("Todos", todoSchema);

const tagSchema = mongoose.Schema({
  id: {
    type: String,
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  url: String,
});

const Tags = mongoose.model("Tags", tagSchema);

const associationSchema = mongoose.Schema({
  todoId: Number,
  tags: {
    type: [Number],
    default: () => [],
  },
});

const TodoTagAssociations = mongoose.model(
  "TodoTagAssociations",
  associationSchema
);

router
  .get("/todos/", listTodos)
  .post("/todos/", addTodos)
  .del("/todos/", clearTodos)
  .get("todo", "/todos/:id", showTodo)
  .del("/todos/:id", removeTodo)
  .patch("/todos/:id", updateTodo)
  .get("/todos/:todoId/tags/", listAssociatedTags)
  .post("/todos/:todoId/tags/", associateTagToTodo)
  .del("/todos/:todoId/tags/", clearAssociatedTags)
  .del("/todos/:todoId/tags/:tagId", removeAssociatedTag)
  .get("/tags/", listTags)
  .post("/tags/", addTag)
  .del("/tags/", clearTags)
  .get("tag", "/tags/:id", showTag)
  .del("/tags/:tagId", removeTag)
  .patch("/tags/:tagId", updateTag)
  .get("/tags/:tagId/todos/", listAssociatedTodos);

async function listTodos(ctx) {
  try {
    const todos = await Todos.find({});
    ctx.body = await Promise.all(
      todos.map(async (todo) => {
        const associatedTags = await getAssociatedTags(todo.id);
        const todoWithTags = {
          id: todo.id,
          title: todo.title,
          completed: todo.completed,
          url: todo.url,
          order: todo.order,
          tags: associatedTags || [],
        };
        return todoWithTags;
      })
    );
  } catch (err) {
    console.log(`Problem fetching for todos: ${err}`);
  }
}

async function clearTodos(ctx) {
  try {
    await TodoTagAssociations.deleteMany({});
    ctx.body = await Todos.deleteMany({});
    ctx.status = 204;
  } catch (err) {
    console.log(`Problem clearing database: ${err}`);
    ctx.status = 500;
  }
}

async function addTodos(ctx) {
  try {
    const todo = ctx.request.body;
    if (!todo.title) ctx.throw(400, { error: '"title" is a required field' });
    const title = todo.title;
    if (!typeof title === "string" || !title.length)
      ctx.throw(400, {
        error: '"title" must be a string with at least one character',
      });

    const highestIdTodo = await Todos.findOne({}, {}, { sort: { id: -1 } });
    let highestId = 0;

    if (highestIdTodo) {
      highestId = highestIdTodo.id;
    }

    todo["url"] = "http://" + ctx.host + router.url("todo", +highestId + 1);
    todo.id = +highestId + 1;

    const savedTodo = await Todos.create(todo);

    ctx.body = savedTodo;
    ctx.status = 303;
    ctx.set("Location", todo["url"]);
  } catch (err) {
    console.error(`Problem adding a Todo: \n${err}`);
  }
}

async function showTodo(ctx) {
  const selectedTodoId = +ctx.params.id;
  try {
    const todo = await Todos.findOne(
      { id: selectedTodoId },
      { _id: 0, __v: 0 }
    );

    if (!todo) {
      ctx.body = `Todo ${selectedTodoId} does not exist !`;
      return;
    }

    const associatedTags = await getAssociatedTags(todo.id);
    const todoWithTags = {
      id: todo.id,
      title: todo.title,
      completed: todo.completed,
      url: todo.url,
      order: todo.order,
      tags: associatedTags || [],
    };

    ctx.body = todoWithTags;
  } catch (err) {
    console.error(`Problem finding Todo with Id=${inputId}: \n${err}`);
    ctx.status = 505;
  }
}

async function updateTodo(ctx) {
  const todoIdToUpdate = ctx.params.id;
  const updateFields = ctx.request.body;

  try {
    const updatedTodo = await Todos.findOneAndUpdate(
      { id: todoIdToUpdate }, // Query to find the todo by its ID
      { $set: updateFields }, // Update the specified fields
      { new: true } // Return the updated document
    );

    if (!updatedTodo) {
      ctx.body = `Todo with an id of ${todoIdToUpdate} does not exist !`;
    } else {
      ctx.body = updatedTodo;
    }
  } catch (err) {
    console.error(`Problem updating Todo with id=${todoIdToUpdate}: \n${err}`);
  }
}

async function removeTodo(ctx) {
  const inputId = ctx.params.id;
  try {
    await Todos.deleteOne({ id: inputId });
    ctx.status = 204;
  } catch (err) {
    console.error(`Problem deleting Todo ${inputId}: \n${err}`);
    ctx.status = 505;
  }
}

async function getAssociatedTodos(selectedTagId) {
  try {
    const associations = await TodoTagAssociations.find({
      tags: selectedTagId,
    });

    return Promise.all(
      associations.map(async (association) => {
        let associatedTodo = await Todos.findOne(
          { id: association.todoId },
          { _id: 0, __v: 0 }
        );
        return associatedTodo;
      })
    );
  } catch (err) {
    console.error(
      `Problem finding todos associated to Tag ${selectedTagId}: \n${err}`
    );
  }
}

async function getAssociatedTags(selectedTodoId) {
  try {
    const association = await TodoTagAssociations.findOne({
      todoId: selectedTodoId,
    });

    if (!association) {
      return null;
    }

    return Promise.all(
      association.tags.map(async (tagId) => {
        return await Tags.findOne({ id: tagId }, { _id: 0, __v: 0 });
      })
    );
  } catch (err) {
    console.error(
      `Problem listing associated tags for Todo ${selectedTodoId}: \n${err}`
    );
    return null;
  }
}

async function listAssociatedTags(ctx) {
  const selectedTodoId = ctx.params.todoId;

  try {
    ctx.body = await getAssociatedTags(selectedTodoId);
  } catch (err) {
    console.error(
      `Problem listing associated tags for Todo ${selectedTodoId}: \n${err}`
    );
  }
}

async function associateTagToTodo(ctx) {
  const selectedTodoId = ctx.params.todoId;
  const tagToAssociateId = ctx.request.body.id;
  try {
    const tag = await Tags.findOne(
      { id: tagToAssociateId },
      { _id: 0, __v: 0 }
    );

    if (!tag) {
      ctx.body = `Tag ${tagToAssociateId} does not exist`;
      return;
    }

    const todo = await Todos.findOne({ id: selectedTodoId });

    if (!todo) {
      ctx.body = `Todo ${selectedTodoId} does not exist`;
      return;
    }

    await TodoTagAssociations.findOneAndUpdate(
      { todoId: selectedTodoId },
      { $addToSet: { tags: tagToAssociateId } },
      { upsert: true, new: true }
    );

    ctx.status = 204;
  } catch (err) {
    console.error(
      `Problem associating tag ${tagToAssociateId} with todo ${selectedTodoId}: \n${err}`
    );
  }
}

async function clearAssociatedTags(ctx) {
  const selectedTodoId = ctx.params.todoId;

  try {
    await TodoTagAssociations.findOneAndUpdate(
      { todoId: selectedTodoId },
      { $set: { tags: [] } }
    );
    ctx.status = 204;
  } catch (err) {
    console.error(`Problem clearing tags for Todo ${selectedTodoId}: \n${err}`);
  }
}

async function removeAssociatedTag(ctx) {
  const selectedTodoId = ctx.params.todoId;
  const selectedTagId = ctx.params.tagId;

  try {
    await TodoTagAssociations.findOneAndUpdate(
      { todoId: selectedTodoId },
      { $pull: { tags: selectedTagId } }
    );
    ctx.status = 204;
  } catch (err) {
    console.error(
      `Problem removing Tag ${selectedTagId} from Todo ${selectedTodoId}`
    );
  }
}

async function listTags(ctx) {
  try {
    const tags = await Tags.find({}, { _id: 0, __v: 0 });
    ctx.body = await Promise.all(
      tags.map(async (tag) => {
        const associatedTodos = await getAssociatedTodos(tag.id);
        const tagWithTodos = {
          id: tag.id,
          title: tag.title,
          url: tag.url,
          todos: associatedTodos || [],
        };
        return tagWithTodos;
      })
    );
  } catch (err) {
    console.log(`Problem fetching for tags: ${err}`);
  }
}

async function addTag(ctx) {
  try {
    const tag = ctx.request.body;
    if (!tag.title) ctx.throw(400, { error: '"title" is a required field' });
    const title = tag.title;
    if (!typeof title === "string" || !title.length)
      ctx.throw(400, {
        error: '"title" must be a string with at least one character',
      });

    const highestIdTag = await Tags.findOne({}, {}, { sort: { id: -1 } });
    let highestId = 0;

    if (highestIdTag) {
      highestId = highestIdTag.id;
    }

    tag["url"] = "http://" + ctx.host + router.url("tag", +highestId + 1);
    tag.id = +highestId + 1;

    ctx.body = await Tags.create(tag);
    ctx.status = 303;
    ctx.set("Location", tag["url"]);
  } catch (err) {
    console.error(`Problem adding a Tag: \n${err}`);
  }
}

async function clearTags(ctx) {
  try {
    await Tags.deleteMany({});
    await TodoTagAssociations.deleteMany({});
    ctx.status = 204;
  } catch (err) {
    console.log(`Problem clearing tags database: ${err}`);
    ctx.status = 500;
  }
}

async function showTag(ctx) {
  const tagToShowId = +ctx.params.id;
  try {
    const tag = await Tags.findOne({ id: tagToShowId }, { _id: 0, __v: 0 });

    if (!tag) {
      ctx.body = `Todo ${tagToShowId} does not exist !`;
      return;
    }

    const associatedTodos = await getAssociatedTodos(tag.id);
    const tagWithTodos = {
      id: tag.id,
      title: tag.title,
      url: tag.url,
      todos: associatedTodos || [],
    };

    ctx.body = tagWithTodos;
  } catch (err) {
    console.error(`Problem finding Tag with Id=${tagToShowId}: \n${err}`);
    ctx.status = 505;
  }
}

async function removeTag(ctx) {
  const tagToRemoveId = ctx.params.tagId;
  try {
    await Tags.deleteOne({ id: tagToRemoveId });
    await TodoTagAssociations.updateMany(
      {},
      { $pull: { tags: tagToRemoveId } },
      { new: true }
    );
    ctx.status = 204;
  } catch (err) {
    console.error(`Problem deleting Tag with id=${tagToRemoveId}: \n${err}`);
    ctx.status = 500;
  }
}

async function updateTag(ctx) {
  const tagToUpdateId = ctx.params.tagId;
  const updateFields = ctx.request.body;

  try {
    const updatedTag = await Tags.findOneAndUpdate(
      { id: tagToUpdateId }, // Query to find the tag by its ID
      { $set: updateFields }, // Update the specified fields
      { new: true } // Return the updated document
    );

    if (!updatedTag) {
      ctx.body = `Tag with an id of ${tagToUpdateId} does not exist !`;
      ctx.status = 500;
    } else {
      ctx.body = updatedTag;
    }
  } catch (err) {
    console.error(`Problem updating Tag with id=${tagToUpdateId}: \n${err}`);
  }
}

async function listAssociatedTodos(ctx) {
  const selectedTagId = ctx.params.tagId;

  try {
    ctx.body = await getAssociatedTodos(selectedTagId);
  } catch (err) {
    console.error(
      `Problem listing associated tags for Todo ${selectedTagId}: \n${err}`
    );
  }
}

app
  .use(bodyParser())
  .use(cors())
  .use(router.routes())
  .use(router.allowedMethods());

app.listen(8080);
