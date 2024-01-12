const express = require("express");
const { graphqlHTTP } = require("express-graphql");
const { buildSchema } = require("graphql");
const neo4j = require("neo4j-driver");

const app = express();
const PORT = 3009;

// Connect to Neo4j
const driver = neo4j.driver(
  "bolt://127.0.0.1:7687",
  neo4j.auth.basic("neo4j", "password")
);
const session = driver.session();

// Define GraphQL schema
const schema = buildSchema(`
  type User {
    id: ID
    name: String
    email: String
  }

  type Query {
    users: [User]
    user(id: ID): User
  }

  type Mutation {
    createUser(name: String, email: String): User
    updateUser(id: ID, name: String, email: String): User
    deleteUser(id: ID): String
  }
`);

// Define GraphQL resolvers
const root = {
  users: async () => {
    const result = await session.run("MATCH (u:User) RETURN u");
    console.log("return all users");
    return result.records.map((record) => ({
      id: record.get("u").identity.low,
      name: record.get("u").properties.name,
      email: record.get("u").properties.email,
    }));
  },
  user: async ({ id }) => {
    const result = await session.run(
      "MATCH (u:User) WHERE id(u) = $id RETURN u",
      { id: parseInt(id) }
    );
    console.log("return data based on user id");
    const record = result.records[0];
    if (record) {
      return {
        id: record.get("u").identity.low,
        name: record.get("u").properties.name,
        email: record.get("u").properties.email,
      };
    }
    return null;
  },
  createUser: async ({ name, email }) => {
    const result = await session.run(
      "CREATE (u:User {name: $name, email: $email}) RETURN u",
      { name, email }
    );
    console.log("create user");
    const record = result.records[0];
    return {
      id: record.get("u").identity.low,
      name: record.get("u").properties.name,
      email: record.get("u").properties.email,
    };
  },
  updateUser: async ({ id, name, email }) => {
    const result = await session.run(
      "MATCH (u:User) WHERE id(u) = $id SET u.name = $name, u.email = $email RETURN u",
      { id: parseInt(id), name, email }
    );
    console.log("update user");
    const record = result.records[0];
    if (record) {
      return {
        id: record.get("u").identity.low,
        name: record.get("u").properties.name,
        email: record.get("u").properties.email,
      };
    }
    return null;
  },
  deleteUser: async ({ id }) => {
    await session.run("MATCH (u:User) WHERE id(u) = $id DETACH DELETE u", {
      id: parseInt(id),
    });
    console.log("delete user ");
    return `User with ID ${id} deleted successfully`;
  },
};

// Use the GraphQL middleware
app.use(
  "/graphql",
  graphqlHTTP({
    schema,
    rootValue: root,
    graphiql: true,
  })
);

// Start the server
app.listen(PORT, () => {
  console.log(`GraphQL Server is running on http://127.0.0.1:${PORT}/graphql`);
});
