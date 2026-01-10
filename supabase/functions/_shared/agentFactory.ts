
import { OpenAI } from "https://esm.sh/openai@4.28.0";
import { getSystemPrompt } from "./promptLoader.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

export interface AgentContext {
  callSid: string;
  callerName?: string;
  callReason?: string;
  email?: string;
  urgency?: boolean;
  language?: string;
  history: any[];
}

export interface AgentResponse {
  response: string;
  toolCall?: {
    name: string;
    arguments: any;
  };
  updatedContext: Partial<AgentContext>;
}

export class AgentFactory {
  static async createAgent(agentName: "Adeline" | "Lisa" | "Christy", context: AgentContext) {
    const systemPrompt = await getSystemPrompt(agentName);

    // Define tools based on agent
    const tools = AgentFactory.getToolsForAgent(agentName);

    return {
      processInput: async (input: string): Promise<AgentResponse> => {
        const messages = [
          { role: "system", content: systemPrompt },
          ...context.history,
          { role: "user", content: input }
        ];

        // Ensure tools is not empty before passing it
        const completionOptions: any = {
          model: "gpt-4-turbo-preview", // Use a smart model
          messages: messages,
          temperature: 0.3, // Conservative setting
        };

        if (tools.length > 0) {
            completionOptions.tools = tools;
            completionOptions.tool_choice = "auto";
        }

        const completion = await openai.chat.completions.create(completionOptions);

        const message = completion.choices[0].message;
        const toolCall = message.tool_calls?.[0];

        if (toolCall) {
          return {
            response: "Processing...",
            toolCall: {
              name: toolCall.function.name,
              arguments: JSON.parse(toolCall.function.arguments)
            },
            updatedContext: {}
          };
        }

        return {
          response: message.content || "I didn't catch that.",
          updatedContext: {}
        };
      }
    };
  }

  static getToolsForAgent(agentName: "Adeline" | "Lisa" | "Christy") {
    if (agentName === "Adeline") {
      return [
        {
          type: "function",
          function: {
            name: "transfer_to_lisa",
            description: "Transfer call to Lisa (Sales Specialist) with context",
            parameters: {
              type: "object",
              properties: {
                caller_name: {
                  type: "string",
                  description: "Caller's full name"
                },
                call_reason: {
                  type: "string",
                  description: "Brief summary of reason for call"
                },
                email: {
                  type: "string",
                  description: "Caller's email address"
                },
                company: {
                  type: "string",
                  description: "Caller's company name (if provided)"
                },
                specific_interest: {
                  type: "string",
                  description: "What they're specifically interested in"
                }
              },
              required: ["caller_name", "call_reason"]
            }
          }
        },
        {
          type: "function",
          function: {
            name: "transfer_to_christy",
            description: "Transfer call to Christy (Support Specialist) with context",
            parameters: {
              type: "object",
              properties: {
                caller_name: {
                  type: "string",
                  description: "Caller's full name"
                },
                call_reason: {
                  type: "string",
                  description: "Brief summary of issue/reason"
                },
                email: {
                  type: "string",
                  description: "Caller's email address"
                },
                problem_description: {
                  type: "string",
                  description: "Detailed description of the problem"
                },
                urgency: {
                  type: "string",
                  enum: ["low", "medium", "high"],
                  description: "Urgency level of the issue"
                },
                caller_emotion: {
                  type: "string",
                  enum: ["calm", "frustrated", "angry"],
                  description: "Caller's emotional state"
                }
              },
              required: ["caller_name", "call_reason", "urgency"]
            }
          }
        },
        {
          type: "function",
          function: {
            name: "end_call",
            description: "End the call professionally",
             parameters: {
              type: "object",
              properties: {
                reason: { type: "string" },
                email: { type: "string", description: "The caller's email if collected" }
              }
            }
          }
        }
      ];
    }

    // Lisa Tools
    if (agentName === "Lisa") {
      return [
        {
          type: "function",
          function: {
            name: "transfer_to_christy",
            description: "Transfer call to Christy (Support) if it turns out to be a support issue",
            parameters: {
              type: "object",
              properties: {
                 caller_name: { type: "string" },
                 issue: { type: "string" },
                 transferred_from: { type: "string", enum: ["Lisa (Sales)"] },
                 reason: { type: "string" }
              },
              required: ["caller_name", "issue"]
            }
          }
        },
        {
          type: "function",
          function: {
             name: "end_call",
             description: "End the call after scheduling next steps or determining no fit",
             parameters: {
                type: "object",
                properties: {
                   result: { type: "string", enum: ["sale", "demo_booked", "follow_up_scheduled", "not_interested", "other"] },
                   notes: { type: "string" }
                },
                required: ["result"]
             }
          }
        }
      ];
    }

    // Christy Tools
    if (agentName === "Christy") {
        return [
           {
            type: "function",
            function: {
              name: "transfer_to_lisa",
              description: "Transfer call to Lisa (Sales) if a sales opportunity arises",
              parameters: {
                type: "object",
                properties: {
                   caller_name: { type: "string" },
                   current_customer: { type: "boolean" },
                   support_issue: { type: "string" },
                   sales_interest: { type: "string" }
                },
                required: ["caller_name", "sales_interest"]
              }
            }
          },
          {
            type: "function",
            function: {
               name: "end_call",
               description: "End the call after resolution or escalation",
               parameters: {
                  type: "object",
                  properties: {
                     resolution_status: { type: "string", enum: ["resolved", "escalated", "follow_up_needed"] },
                     notes: { type: "string" }
                  },
                  required: ["resolution_status"]
               }
            }
          }
        ];
    }

    return [];
  }
}
