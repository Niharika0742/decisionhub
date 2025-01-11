import { createError } from "../error.js";
import Rule from "../models/Rule.js"; // MongoDB model for Rule
import User from "../models/User.js"; // MongoDB model for User
import Version from "../models/Version.js"; // MongoDB model for Version
import BankUser from "../models/BankUser.js"; // MongoDB model for BankUser
import * as dotenv from "dotenv";
import { createRuleRequest } from "../utils/prompt.js";
import OpenAI from "openai";
import xlsx from "xlsx";
import path from "path";

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const createRule = async (req, res, next) => {
  const {
    title,
    description,
    tables,
    inputAttributes,
    outputAttributes,
    condition,
  } = req.body;
  const userId = req.user.id;
  try {
    const user = await User.findById(userId);
    if (!user) {
      return next(createError(404, "User not found"));
    }
    
    // Create the rule
    const rule = new Rule({
      title,
      description,
      tables,
      inputAttributes,
      outputAttributes,
      condition,
    });
    await rule.save();

    // Create version for the rule
    const version = new Version({
      title: rule.title,
      description: rule.description,
      tables: rule.tables,
      inputAttributes: rule.inputAttributes,
      outputAttributes: rule.outputAttributes,
      condition: rule.condition,
      version: 1, // Assuming version 1 for the first version
    });
    await version.save();

    // Associate the rule with the user
    user.rules.push(rule._id);
    await user.save();

    // Associate the version with the rule
    rule.versions.push(version._id);
    await rule.save();

    return res.status(201).json(rule);
  } catch (error) {
    return next(error);
  }
};

export const getRules = async (req, res, next) => {
  const userId = req.user.id;
  try {
    const user = await User.findById(userId);
    if (!user) {
      return next(createError(404, "User not found"));
    }

    // Fetch all rules associated with the user
    const rules = await Rule.find({ _id: { $in: user.rules } });
    return res.status(200).json(rules);
  } catch (error) {
    return next(error);
  }
};

export const getRuleByIdAndVersion = async (req, res, next) => {
  const userId = req.user.id;
  const { id } = req.params;
  const version = req.body.version;
  try {
    const user = await User.findById(userId);
    if (!user) {
      return next(createError(404, "User not found"));
    }

    // Find the rule by ID
    const rule = await Rule.findById(id);
    if (!rule) {
      return res.status(404).json({ error: "Rule not found" });
    }

    // Check if the user owns the rule
    if (!user.rules.includes(id)) {
      return next(createError(403, "You are not the owner of this rule"));
    }

    // Get versions of the rule
    const versions = await Version.find({ _id: { $in: rule.versions } });
    let versionValues = versions.map((version) => version.version);

    if (!version) {
      return res.status(200).json({ rule, versions: versionValues });
    } else {
      const ruleVersion = await Version.findOne({
        rule: id,
        version,
      });
      if (!ruleVersion) {
        return res.status(404).json({ error: "Rule version not found" });
      }
      return res.status(200).json({ rule: ruleVersion, versions: versionValues });
    }
  } catch (error) {
    return next(createError(error.status, error.message));
  }
};

export const searchRule = async (req, res) => {
  const userId = req.user.id;
  const query = req.query.title;
  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Fetch rules associated with the user
    const userRules = user.rules; // Assuming user.rules is an array of rule IDs

    // Search for rules with the given title
    const rules = await Rule.find({
      _id: { $in: userRules }, // Filter by user's rules
      title: { $regex: query, $options: "i" }, // Case-insensitive search
    }).limit(40);

    res.status(200).json(rules);
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Update a rule
export const updateRule = async (req, res, next) => {
  const userId = req.user.id;
  const ruleId = req.params.id;
  const newRule = req.body;
  const version = req.body.version;
  try {
    const user = await User.findById(userId);
    if (!user) {
      return next(createError(404, "User not found"));
    }

    // Find the rule by ID
    const rule = await Rule.findById(ruleId);
    if (!rule) {
      return next(createError(404, "No rule with that id"));
    }

    // Check if the user is the owner of the rule
    if (!user.rules.includes(ruleId)) {
      return next(createError(403, "You are not the owner of this rule"));
    }

    // Check if the version is the same as the rule's current version
    if (version === rule.version) {
      // Update the rule
      rule.title = newRule.title;
      rule.description = newRule.description;
      rule.tables = newRule.tables;
      rule.inputAttributes = newRule.inputAttributes;
      rule.outputAttributes = newRule.outputAttributes;
      rule.condition = newRule.condition;
      rule.version = newRule.version;
      await rule.save();

      // Update the version
      const versionDoc = await Version.findOne({ rule: ruleId, version: version });
      if (versionDoc) {
        versionDoc.title = newRule.title;
        versionDoc.description = newRule.description;
        versionDoc.tables = newRule.tables;
        versionDoc.inputAttributes = newRule.inputAttributes;
        versionDoc.outputAttributes = newRule.outputAttributes;
        versionDoc.condition = newRule.condition;
        versionDoc.version = newRule.version;
        await versionDoc.save();
      }

      const versions = await Version.find({ rule: ruleId });
      const versionValues = versions.map((version) => version.version);
      return res.status(200).json({ rule, versions: versionValues });
    } else {
      // If the version is different, update the version document
      const ruleVersion = await Version.findOne({ rule: ruleId, version: version });
      if (!ruleVersion) {
        return next(createError(404, "Version not found"));
      }

      ruleVersion.title = newRule.title;
      ruleVersion.description = newRule.description;
      ruleVersion.tables = newRule.tables;
      ruleVersion.inputAttributes = newRule.inputAttributes;
      ruleVersion.outputAttributes = newRule.outputAttributes;
      ruleVersion.condition = newRule.condition;
      ruleVersion.version = newRule.version;
      await ruleVersion.save();

      const versions = await Version.find({ rule: ruleId });
      const versionValues = versions.map((version) => version.version);
      return res.status(200).json({ rule: ruleVersion, versions: versionValues });
    }
  } catch (error) {
    return next(createError(error.status, error.message));
  }
};


export const updateRuleWithVersion = async (req, res, next) => {
  const userId = req.user.id;
  const ruleId = req.params.id;
  const newRule = req.body;
  try {
    const user = await User.findById(userId);
    if (!user) {
      return next(createError(404, "User not found"));
    }
    const rule = await Rule.findById(ruleId);
    if (!rule) {
      return next(createError(404, "No rule with that id"));
    }
    // Check if user is owner of this rule
    if (!user.rules.includes(ruleId)) {
      return next(createError(403, "You are not owner of this rule"));
    }

    rule.set({ ...newRule, version: (rule.version + 0.1).toFixed(1) });
    await rule.save();

    const updatedRule = await Rule.findById(ruleId);
    const version = new Version({
      title: updatedRule.title,
      description: updatedRule.description,
      tables: updatedRule.tables,
      inputAttributes: updatedRule.inputAttributes,
      outputAttributes: updatedRule.outputAttributes,
      condition: updatedRule.condition,
      version: updatedRule.version,
    });
    await version.save();
    updatedRule.versions.push(version);
    await updatedRule.save();

    const versions = await Rule.find({ _id: ruleId }).populate('versions');
    let versionValues = versions[0].versions.map((version) => version.version);
    
    return res.status(200).json({ rule: updatedRule, versions: versionValues });
  } catch (error) {
    return next(createError(error.status, error.message));
  }
};

export const deleteRule = async (req, res, next) => {
  const userId = req.user.id;
  const ruleId = req.params.id;
  const version = req.params.versionId;
  try {
    const user = await User.findById(userId);
    if (!user) {
      return next(createError(404, "User not found"));
    }
    const rule = await Rule.findById(ruleId);
    if (!rule) {
      return next(createError(404, "No rule with that id"));
    }
    // Check if user is owner of this rule
    if (!user.rules.includes(ruleId)) {
      return next(createError(403, "You are not owner of this rule"));
    }

    const versionToDelete = await Version.findOneAndDelete({ ruleId, version });
    if (version === rule.version) {
      const ruleVersions = await Version.find({ ruleId }).sort({ version: 1 });
      if (ruleVersions.length === 0) {
        await Rule.findByIdAndDelete(ruleId);
        return res.status(204).json({ message: "Rule deleted successfully" });
      } else {
        const latestVersion = ruleVersions[ruleVersions.length - 1];
        rule.title = latestVersion.title;
        rule.description = latestVersion.description;
        rule.tables = latestVersion.tables;
        rule.inputAttributes = latestVersion.inputAttributes;
        rule.outputAttributes = latestVersion.outputAttributes;
        rule.condition = latestVersion.condition;
        rule.version = latestVersion.version;
        await rule.save();

        const versionValues = ruleVersions.map((version) => version.version);
        return res.status(200).json({ rule, versions: versionValues });
      }
    } else {
      const ruleVersions = await Version.find({ ruleId }).sort({ version: 1 });
      const versionValues = ruleVersions.map((version) => version.version);
      return res.status(200).json({ rule, versions: versionValues });
    }
  } catch (error) {
    return next(createError(error.status, error.message));
  }
};

export const testingExcel = async (req, res, next) => {
  const storagePath = "FILES_STORAGE/";
  const userId = req.user.id;
  const { id } = req.params;
  let data = [];
  try {
    const user = await User.findById(userId);
    if (!user) {
      return next(createError(404, "User not found"));
    }
    const rule = await Rule.findById(id);
    if (!rule) {
      return next(createError(404, "No rule with that id"));
    }
    // Check if user is owner of this rule
    if (!user.rules.includes(id)) {
      return next(createError(403, "You are not owner of this rule"));
    }
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const filePath = path.join(storagePath, file.filename);
    let workbook = xlsx.readFile(filePath);
    let sheet_name_list = workbook.SheetNames;

    sheet_name_list.forEach(async function (y) { 
      var worksheet = workbook.Sheets[y];
      // getting the complete sheet
      let headers = {};
      for (let z in worksheet) {
        if (z[0] === "!") continue;
        // parse out the column, row, and value
        var col = z.substring(0, 1);
        var row = parseInt(z.substring(1));
        var value = worksheet[z].v;
        // store header names
        if (row == 1) {
          headers[col] = value;
          // storing the header names
          continue;
        }
        if (!data[row]) data[row] = {};
        data[row][headers[col]] = value;
      }
      // drop those first two rows which are empty
      data.shift();
      data.shift();
      await data.map(async (inputData, index) => {
        const condition = JSON.parse(rule.condition);
        let testedRule;
        const attributeNode = condition.nodes.find(
          (node) => node.type === "attributeNode"
        );

        const firstConditionalNodeId = condition.edges.find(
          (edge) => edge.source === "1"
        ).target;

        if (firstConditionalNodeId) {
          const firstConditionalNode = condition.nodes.find(
            (node) => node.id === firstConditionalNodeId
          );

          if (firstConditionalNode) {
            // sets the attribute Node color
            condition.nodes.forEach((node, index) => {
              if (node.type === "attributeNode") {
                condition.nodes[index] = {
                  ...node,
                  data: {
                    ...node.data,
                    computed: "yes",
                    color: "#02ab40",
                    result: true,
                  },
                };
              }
            });

            condition.edges.forEach((edge, index) => {
              if (
                edge.source === attributeNode.id &&
                edge.target === firstConditionalNode.id
              ) {
                condition.edges[index] = {
                  ...edge,
                  animated: true,
                  markerEnd: {
                    type: "arrowclosed",
                    width: 12,
                    height: 12,
                    color: "#02ab40",
                  },
                  style: {
                    strokeWidth: 5,
                    stroke: "#02ab40",
                  },
                };
              }
            });
            let traversalNodes = [];
            testedRule = await evaluateNodes(
              firstConditionalNode,
              condition,
              rule,
              traversalNodes,
              inputData,
              { condition: JSON.stringify(condition) }
            );
            if (testedRule.output) {
              inputData[testedRule?.output[0]?.field] = testedRule?.output[0]?.value;
            }
            data[index] = inputData;
            rule.condition = testedRule?.rule?.condition;
          }
        }
      })

    });
    await Rule.findByIdAndUpdate(id, { tested: true });
    res.status(200).json({
      fields: Object.keys(data[0]),
      data: data,
    });
  } catch (error) {
    return next(createError(error.status, error.message));
  }
};

export const createRuleWithText = async (req, res, next) => {
  const userId = req.user.id;
  const ruleId = req.params.id;
  const { version, conditions } = req.body;
  try {
    const user = await User.findById(userId);
    if (!user) {
      return next(createError(404, "User not found"));
    }
    const rule = await Rule.findById(ruleId);
    if (!rule) {
      return next(createError(404, "No rule with that id"));
    }
    // Check if user is owner of this rule
    if (!user.rules.includes(ruleId)) {
      return next(createError(403, "You are not owner of this rule"));
    }
    const parsedRule = {
      title: rule.title,
      description: rule.description,
      inputAttributes: rule.inputAttributes,
      outputAttributes: rule.outputAttributes,
      condition: JSON.parse(rule.condition),
    };
    const prompt = createRuleRequest(conditions, JSON.stringify(parsedRule));
    const completion = await openai.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "gpt-3.5-turbo",
    });

    const newCondition = JSON.parse(
      completion.choices[0].message.content
    ).condition;

    if (rule.version === version) {
      rule.title = rule.title;
      rule.description = rule.description;
      rule.inputAttributes = rule.inputAttributes;
      rule.outputAttributes = rule.outputAttributes;
      rule.version = rule.version;
      rule.condition = JSON.stringify(newCondition);
      await rule.save();

      const updatedRule = await Rule.findById(ruleId);

      await Version.updateOne(
        { ruleId: ruleId, version: version },
        {
          title: updatedRule.title,
          description: updatedRule.description,
          inputAttributes: updatedRule.inputAttributes,
          outputAttributes: updatedRule.outputAttributes,
          version: updatedRule.version,
          condition: updatedRule.condition,
        }
      );
 

//------------------------------------------------

const versions = await Version.find({ ruleId: ruleId }).sort({ version: 1 });
let versionValues = [];
versions.map((version) => {
  versionValues.push(version.version);
});
return res
  .status(200)
  .json({ rule: updatedRule, versions: versionValues });
} else {
  const ruleVersion = await Version.findOne({
    ruleId: ruleId,
    version: version,
  });

  await Version.updateOne(
    { _id: ruleVersion._id },
    {
      title: ruleVersion.title,
      description: ruleVersion.description,
      inputAttributes: ruleVersion.inputAttributes,
      outputAttributes: ruleVersion.outputAttributes,
      version: ruleVersion.version,
      condition: JSON.stringify(newCondition),
    }
  );

  const updatedVersion = await Version.findOne({
    _id: ruleVersion._id,
  });

  const versions = await Version.find({ ruleId: ruleId }).sort({ version: 1 });
  let versionValues = [];
  versions.map((version) => {
    versionValues.push(version.version);
  });

  return res
    .status(200)
    .json({ rule: updatedVersion, versions: versionValues });
}
} catch (error) {
  return next(createError(error.status, error.message));
}
};
const specialFunctions = ["date_diff", "time_diff"];
const specialArrtibutes = ["current_date", "current_time"];

const setEdgeColor = (condition, node, traversalNodes, color, result) => {
  const targetEdges = condition.edges.filter(
    (edge) =>
      edge.source === node.id &&
      edge.sourceHandle &&
      edge.sourceHandle === result
  );

  targetEdges.forEach((edge, index) => {
    const targetNode = condition.nodes.find((n) => n.id === edge.target);
    if (targetNode) {
      traversalNodes.push(targetNode);
    }

    condition.edges = condition.edges.map((e) =>
      e.id === targetEdges[index].id
        ? {
          ...e,
          animated: true,
          markerEnd: {
            type: "arrowclosed",
            width: 12,
            height: 12,
            color: color,
          },
          style: {
            strokeWidth: 5,
            stroke: color,
          },
        }
        : e
    );
  });

  return condition;
};

const setNodeColor = (
  condition,
  node,
  traversalNodes,
  color,
  computed,
  result
) => {
  const targetNode = condition.nodes.find((n) => n.id === node.id);

  traversalNodes.forEach((n) => {
    if (n.id === targetNode.id) {
      n.data.computed = computed;
      n.data.color = color;
      n.data.result = result;
    }
  });

  condition.nodes = condition.nodes.map((n) =>
    n.id === targetNode.id
      ? {
        ...n,
        data: {
          ...n.data,
          computed: computed,
          color: color,
          result: result,
        },
      }
      : n
  );

  return condition;
};


//--------------------------
// Function to test with DB (MongoDB version)
export const testWithDb = async (req, res, next) => {
  const userId = req.user.id;
  const id = req.params.id;
  const tableName = req.body.name;
  try {
    const user = await User.findById(userId);
    if (!user) {
      return next(createError(404, "User not found"));
    }
    const rule = await Rule.findById(id);
    if (!rule) {
      return next(createError(404, "No rule with that id"));
    }

    // Check if user is owner of this rule
    const userRules = await user.populate("rules");
    const ruleIds = userRules.rules.map((rule) => rule.id);
    if (!ruleIds.includes(id)) {
      return next(createError(403, "You are not owner of this rule"));
    }

    // MongoDB equivalent of querying a collection
    const tableData = await mongoose.connection.db.collection(tableName).find().toArray();
    return res.json(tableData);
  } catch (error) {
    return next(createError(error.status, error.message));
  }
}

// Function to evaluate nodes in the condition
const evaluateNodes = async (
  node,
  condition,
  rule,
  traversalNodes,
  inputAttributes,
  testedRule
) => {
  const result = evaluateConditions(
    node.data.conditions,
    node.data.rule,
    inputAttributes
  );

  if (result[0]) {
    let updatedCondition = setEdgeColor(
      condition,
      node,
      traversalNodes,
      "#02ab40",
      "yes"
    );
    updatedCondition = setNodeColor(
      updatedCondition,
      node,
      traversalNodes,
      "#02ab40",
      "yes",
      result[1]
    );
    condition = updatedCondition;
    testedRule.condition = JSON.stringify(updatedCondition);
  } else {
    let updatedCondition = setEdgeColor(
      condition,
      node,
      traversalNodes,
      "#02ab40",
      "no"
    );
    updatedCondition = setNodeColor(
      updatedCondition,
      node,
      traversalNodes,
      "#02ab40",
      "no",
      result[1]
    );
    condition = updatedCondition;
    testedRule.condition = JSON.stringify(updatedCondition);
  }

  let nextNode;

  if (traversalNodes.length === 1) {
    if (traversalNodes[0].type === "outputNode") {
      // Change and add the color of output node
      let updatedCondition = setNodeColor(
        condition,
        traversalNodes[0],
        traversalNodes,
        "#02ab40",
        [true]
      );
      condition = updatedCondition;
      testedRule.condition = JSON.stringify(updatedCondition);
      return { rule: testedRule, output: traversalNodes[0].data.outputFields };
    }
    nextNode = traversalNodes[0];
    // Set the traversalNodes to empty array
    traversalNodes = [];
  } else if (traversalNodes.length > 1) {
    let nestedResult;
    for (let i = 0; i < traversalNodes.length; i++) {
      nestedResult = evaluateConditions(
        traversalNodes[i].data.conditions,
        traversalNodes[i].data.rule,
        inputAttributes
      );
      if (nestedResult[0] === true) {
        nextNode = traversalNodes[i];
      } else {
        let updatedCondition = setNodeColor(
          condition,
          traversalNodes[i],
          traversalNodes,
          "#FF0072",
          "null",
          nestedResult[1]
        );
        condition = updatedCondition;
        // Set the edge color to red which target is this node and source is the previous node
        const targetEdges = condition.edges.filter(
          (edge) => edge.target === traversalNodes[i].id
        );

        targetEdges.forEach((edge, index) => {
          condition.edges = condition.edges.map((e) =>
            e.id === targetEdges[index].id
              ? {
                ...e,
                animated: true,
                markerEnd: {
                  type: "arrowclosed",
                  width: 12,
                  height: 12,
                  color: "#FF0072",
                },
                style: {
                  strokeWidth: 5,
                  stroke: "#FF0072",
                },
              }
              : e
          );
        });
        testedRule.condition = JSON.stringify(updatedCondition);
      }
    }

    traversalNodes = [];
  }

  if (!nextNode) {
    return { rule: testedRule, output: [] };
  }

  if (nextNode.type === "outputNode") {
    let updatedCondition = setNodeColor(
      condition,
      traversalNodes[0],
      traversalNodes,
      "#02ab40",
      [true]
    );
    condition = updatedCondition;
    testedRule.condition = JSON.stringify(updatedCondition);
    return { rule: testedRule, output: nextNode.data.outputFields };
  } else {
    return evaluateNodes(
      nextNode,
      condition,
      rule,
      traversalNodes,
      inputAttributes,
      testedRule
    );
  }
};

//----------------------------

// Function to test with DB (MongoDB version)
export const testing = async (req, res, next) => {
  const inputAttributes = req.body;
  const { id, version } = req.params;
  const userId = req.user.id;

  try {
    const user = await User.findById(userId);
    if (!user) {
      return next(createError(404, "User not found"));
    }

    let rule = await Rule.findById(id);
    if (!rule) {
      return next(createError(404, "No rule with that id"));
    }

    // Check if user is owner of this rule
    const userRules = await user.populate("rules");
    const ruleIds = userRules.rules.map((r) => r.id);
    if (!ruleIds.includes(id)) {
      return next(createError(403, "You are not owner of this rule"));
    }

    const testRule = await Version.findOne({
      ruleId: id,
      version: version,
    });

    if (!testRule) {
      return next(createError(404, "Version not found"));
    }

    const versions = await rule.populate("versions");
    let versionValues = [];

    versions.sort((a, b) => a.version - b.version).forEach((v) => {
      versionValues.push(v.version);
    });

    const condition = JSON.parse(testRule.condition);
    let testedRule;
    const attributeNode = condition.nodes.find(
      (node) => node.type === "attributeNode"
    );

    const firstConditionalNodeId = condition.edges.find(
      (edge) => edge.source === "1"
    ).target;

    if (firstConditionalNodeId) {
      const firstConditionalNode = condition.nodes.find(
        (node) => node.id === firstConditionalNodeId
      );

      if (firstConditionalNode) {
        // Sets the attribute Node color
        condition.nodes.forEach((node, index) => {
          if (node.type === "attributeNode") {
            condition.nodes[index] = {
              ...node,
              data: {
                ...node.data,
                computed: "yes",
                color: "#02ab40",
                result: true,
              },
            };
          }
        });

        condition.edges.forEach((edge, index) => {
          if (
            edge.source === attributeNode.id &&
            edge.target === firstConditionalNode.id
          ) {
            condition.edges[index] = {
              ...edge,
              animated: true,
              markerEnd: {
                type: "arrowclosed",
                width: 12,
                height: 12,
                color: "#02ab40",
              },
              style: {
                strokeWidth: 5,
                stroke: "#02ab40",
              },
            };
          }
        });

        let traversalNodes = [];
        testedRule = await evaluateNodes(
          firstConditionalNode,
          condition,
          rule,
          traversalNodes,
          inputAttributes,
          { condition: JSON.stringify(condition) }
        );
        console.log(testedRule);
        rule.condition = testedRule.rule.condition;
      }
    }

    await Rule.updateOne(
      { _id: id },
      { $set: { ...rule, tested: true } }
    );

    return res.json({
      rule: rule,
      versions: versionValues,
      output: testedRule?.output ? testedRule.output : null,
    });
  } catch (error) {
    return next(createError(error.status, error.message));
  }
};

// Function to evaluate expression
function evaluateExpression(expression, inputData) {
  const { lhs, comparator, rhs } = expression;

  const evaluateSide = (side, inputData) => {
    const sideResults = []; // Array to store results of each operand
    const getComparisonValue = (attribute, inputData) => {
      const attributeValue =
        inputData[attribute] !== undefined
          ? String(inputData[attribute]).toLowerCase()
          : String(attribute).toLowerCase();

      return attributeValue;
    };

    side.forEach((operand) => {
      let sideValue = 0;

      if (operand.op1 === null) {
        // Use the result of the previous evaluation
        if (sideResults.length > 0) {
          sideValue = sideResults[sideResults.length - 1];
        } else {
          // Handle if no previous result is available
          sideValue = 0;
        }
      } else if (checkSpecialFunction(operand.op1.split(",")[0])) {
        sideValue = evaluateSpecialFunction(operand.op1, inputData);
      } else {
        sideValue = getComparisonValue(operand.op1, inputData);
      }

      switch (operand.operator) {
        case "/":
          sideValue /= parseFloat(operand.op2);
          break;
        case "*":
          sideValue *= parseFloat(operand.op2);
          break;
        case "+":
          sideValue += parseFloat(operand.op2);
          break;
        case "-":
          sideValue -= parseFloat(operand.op2);
          break;
        default:
          if (comparator === "==" || comparator === "!=") {
            sideValue = sideValue;
          } else {
            sideValue = parseFloat(sideValue);
          }
          break;
      }

      // Store the result of the current operand in the array
      sideResults.push(sideValue);
    });

    // Return the final result of the last operand
    return sideResults.length > 0 ? sideResults[sideResults.length - 1] : 0;
  };

  const leftSideValue = evaluateSide(lhs, inputData);
  const rightSideValue = evaluateSide(rhs, inputData);

  switch (comparator) {
    case ">":
      return leftSideValue > rightSideValue;
    case "<":
      return leftSideValue < rightSideValue;
    case "==":
      return leftSideValue == rightSideValue;
    case "!=":
      return leftSideValue !== rightSideValue;
    case ">=":
      return leftSideValue >= rightSideValue;
    case "<=":
      return leftSideValue <= rightSideValue;
    default:
      return false;
  }
}

function checkSpecialFunction(func) {
  return specialFunctions.includes(func);
}

function evaluateSpecialFunction(inputAttribute, inputData) {
  const [specialFunction, attribute1, attribute2, unit] =
    inputAttribute.split(",");

  const getDateAttributeValue = (attribute) => {
    return attribute.toLowerCase() === "current_date"
      ? new Date()
      : new Date(inputData[attribute]);
  };

  const getDateTimeAttributeValue = (attribute) => {
    return attribute.toLowerCase() === "current_time"
      ? new Date()
      : new Date(inputData[attribute]);
  };

  const date1 = getDateAttributeValue(attribute1);
  const date2 = getDateAttributeValue(attribute2);

  const time1 = getDateTimeAttributeValue(attribute1);
  const time2 = getDateTimeAttributeValue(attribute2);

  const calculateDateDifference = (date1, date2, unit) => {
    const diffInMilliseconds = Math.abs(date1 - date2);

    switch (unit) {
      case "years":
        return Math.floor(diffInMilliseconds / (365 * 24 * 60 * 60 * 1000));

      case "months":
        return Math.floor(diffInMilliseconds / (30 * 24 * 60 * 60 * 1000));

      case "days":
        return Math.floor(diffInMilliseconds / (24 * 60 * 60 * 1000));

      default:
        return null; // Handle unknown units
    }
  };

  const calculateTimeDifference = (time1, time2, unit) => {
    const diffInSeconds = Math.abs(time1 - time2) / 1000;

    switch (unit) {
      case "seconds":
        return Math.floor(diffInSeconds);

      case "minutes":
        return Math.floor(diffInSeconds / 60);

      case "hours":
        return Math.floor(diffInSeconds / (60 * 60));

      default:
        return null; // Handle unknown units
    }
  };

  switch (specialFunction) {
    case "date_diff":
      return calculateDateDifference(date1, date2, unit);

    case "time_diff":
      return calculateTimeDifference(time1, time2, unit);

    default:
      return 0; // Handle unknown special functions
  }
}

function evaluateCondition(condition, inputData) {
  const { expression, boolean } = condition;
  // Evaluate the first expression
  let result = [];
  result.push(evaluateExpression(expression, inputData));
  return result[result.length - 1];
}

function evaluateConditions(conditions, rule, inputAttributes) {
  let result = [];
  const eachConditionResult = [];
  let logicalOperator = null;

  for (const condition of conditions) {
    const conditionResult = evaluateCondition(condition, inputAttributes);
    eachConditionResult.push(conditionResult);

    if (logicalOperator) {
      // If a logical operator is present, combine the previous result with the current result
      result[result.length - 1] = performLogicalOperation(
        result[result.length - 1],
        logicalOperator,
        conditionResult
      );
      logicalOperator = null;
    } else {
      // If no logical operator, simply push the current result
      result.push(conditionResult);
    }

    if (condition.boolean != null || condition.boolean != undefined) {
      // If a logical operator is found, store it for the next iteration
      logicalOperator = condition.boolean;
    }
  }
  console.log(result);
  if (rule === "Any") {
    return [result.includes(true), eachConditionResult];
  } else if (rule === "All") {
    return [result.every(Boolean), eachConditionResult];
  }

  return [result[0], eachConditionResult];
}

// Helper function to perform logical operations
function performLogicalOperation(operand1, operator, operand2) {
  switch (operator) {
    case "&&":
      return operand1 && operand2;
    case "||":
      return operand1 || operand2;
    default:
      return false;
  }
}
