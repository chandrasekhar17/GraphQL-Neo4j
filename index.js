// @ts-nocheck
const express = require("express");
const { ApolloServer, gql } = require("apollo-server-express");
const neo4j = require("neo4j-driver");
const cors = require("cors");
const jwt = require("jsonwebtoken"); // Add JWT library
const app = express();
const PORT = 3009;
const crypto = require("crypto");

const generateSecretKey = () => {
  return crypto.randomBytes(16).toString("hex");
};

const secretKey = generateSecretKey();
console.log("Generated Secret Key:", secretKey);

// Neo4j connection
const neo4jUri = "bolt://127.0.0.1:7687";
const neo4jUser = "neo4j";
const neo4jPassword = "password";

const driver = neo4j.driver(
  neo4jUri,
  neo4j.auth.basic(neo4jUser, neo4jPassword)
);
const getDataQuery = (type) => `MATCH (n:${type}) RETURN n`;
const typeDefs = gql`
  type Coach {
    name: String!
  }

  type Team {
    name: String!
  }

  type Query {
    getCoaches: [Coach]
    getTeams: [Team]
  }
`;

const SECRET_KEY = secretKey;

// Middleware to verify JWT token
const authenticateJWT = (req, res, next) => {
  const token = req.header("Authorization");

  if (!token || !token.startsWith("Bearer")) {
    return res
      .status(401)
      .json({ message: "Unauthorized - No valid token provided" });
  }

  const tokenValue = token.split(" ")[1].trim(); // Trim to remove whitespaces

  if (!tokenValue) {
    return res
      .status(401)
      .json({ message: "Unauthorized - No valid token provided" });
  }

  try {
    const decoded = jwt.verify(tokenValue, SECRET_KEY);
    req.user = decoded.user;
    console.log("Decoded Token:", decoded);
    next();
  } catch (error) {
    console.error("Token verification failed:", error.message);
    return res.status(401).json({ message: "Unauthorized - Invalid token" });
  }
};

// resolver function
const resolvers = {
  Query: {
    getCoaches: async () => {
      const session = driver.session();
      const result = await session.run(getDataQuery("COACH"));
      const coaches = result.records.map((record) => {
        return {
          name: record.get("n").properties.name,
        };
      });
      session.close();
      return coaches;
    },
    getTeams: async () => {
      const session = driver.session();
      const result = await session.run(getDataQuery("TEAM"));
      const teams = result.records.map((record) => {
        return {
          name: record.get("n").properties.name,
        };
      });
      session.close();
      return teams;
    },
  },
};

// create a new apollo server by binding graphQL schema and resolvers
const server = new ApolloServer({ typeDefs, resolvers });

app.use(cors());
app.use(authenticateJWT);

async function startServer() {
  await server.start();
  server.applyMiddleware({ app, path: "/graphql" });
}

startServer().then(() => {
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
});
