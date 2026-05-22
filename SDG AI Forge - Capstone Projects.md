# AI-Forge 2026 Programme — Capstone Project Assignments

## Overview

Congratulations on completing all learning modules and progressive projects (Projects 1 through 13) of the AI-Forge 2026 Programme. You have built a strong foundation in Generative AI, Prompt Engineering, LLM integration, RAG pipelines, database-connected AI, and agentic systems. The Capstone Project is the culminating exercise where you will apply everything you have learned to deliver a production-grade AI application.

This document serves as the official instruction guide for the Capstone Project phase. Please read it thoroughly before beginning any work.

---

## Project Assignment

### How Projects Are Assigned

Each participant has been individually assigned one capstone project from the list of 15 projects described in the accompanying AI-Forge 2026 Capstone Project Assignments document. A separate assignment sheet identifies which project is assigned to which participant.

### Assignment Rules

- Refer to the separate assignment sheet to identify your designated capstone project. If you have not received this sheet, contact ATG immediately.
- You must work only on the project assigned to you. Participants are not permitted to swap, choose, or take on any project other than the one explicitly assigned.
- The project descriptions, features, and workflow patterns outlined in the Capstone Project Assignments document are your primary reference for scope and deliverables.

### Timeline and Duration

- **Duration:** You have 2 weeks (15 calendar days) from your assigned start date to complete and deliver the capstone project.
- **Start and end dates:** Will be communicated by your reporting manager along with the project assignment sheet.
- **Progress tracking:** Your reporting manager is responsible for tracking your progress throughout the 2-week period. Expect periodic check-ins.

---

## Important Rules and Expectations

| # | Rule |
|---|------|
| 1 | Work only on the capstone project that has been explicitly assigned to you. No exceptions. |
| 2 | Do not pick, swap, or request a different project from the capstone catalogue. |
| 3 | Complete the project within the 2-week timeframe. Extensions will only be granted under exceptional circumstances approved by your reporting manager and ATG. |
| 4 | Maintain regular communication with your reporting manager regarding progress. |
| 5 | Be prepared for a full demonstration at the end of the 2-week period covering application walkthrough, code walkthrough, tools and techniques explanation, and architecture diagram. |
| 6 | Use clean, well-structured, and documented code. Production-quality standards are expected. |
| 7 | Original work is mandatory. Plagiarism or reuse of another participant's work is strictly prohibited. |

---

## Final Deliverables

At the end of the 2-week period, each participant must be prepared to deliver and demonstrate the following:

### Application Walkthrough

A live demonstration of the working application, showcasing all implemented features and the end-to-end workflow as defined in your assigned project. The application should be functional and demonstrate real outputs (not mocked data).

### Code Walkthrough

A guided walkthrough of the codebase explaining the project structure, key modules, design decisions, agent configurations, prompt strategies, and how the various components interact. Clean, well-organized, and documented code is expected.

### Framework, Tools, and Techniques

A clear explanation of the frameworks (e.g., LangGraph, N8N, LangChain), tools (e.g., vector databases, OCR engines, APIs), and techniques (e.g., RAG, multi-agent orchestration, prompt chaining) used in the project, along with the rationale for choosing them.

### Application Architecture Diagram

Providing a comprehensive application architecture diagram is **highly recommended**. The diagram should depict all technical elements of the solution, including:

- Frontend and backend components
- AI agents, their roles, and inter-agent communication
- LLM provider integrations
- Data stores (databases, vector stores, caches)
- External APIs or services
- Workflow/orchestration flow and data pipelines

---

## Contents: Project Details

1. [Enterprise Productivity: The AI-Powered Meeting Assistant](#1-enterprise-productivity-the-ai-powered-meeting-assistant)
2. [Code Generation: The "Docs-to-API" Feature](#2-code-generation-the-docs-to-api-feature)
3. [Multi-Modal Document Data Extraction: The "Invoice-to-JSON" Processor](#3-multi-modal-document-data-extraction-the-invoice-to-json-processor)
4. [Healthcare: The "Patient Onboarding" Assistant](#4-healthcare-the-patient-onboarding-assistant)
5. [Data Extraction from Poor Quality Images: The "Receipt Digitizer"](#5-data-extraction-from-poor-quality-images-the-receipt-digitizer)
6. [HR Tech: The "Resume Screening" Swarm](#6-hr-tech-the-resume-screening-swarm)
7. [Enterprise Productivity: The "Internal Knowledge Base" Navigator](#7-enterprise-productivity-the-internal-knowledge-base-navigator)
8. [Code Generation: The "Unit Test" Creator](#8-code-generation-the-unit-test-creator)
9. [Multi-Modal Document Data Extraction: The "Contract Analysis" Tool](#9-multi-modal-document-data-extraction-the-contract-analysis-tool)
10. [HR Tech: The "Employee Onboarding" Workflow Automator](#10-hr-tech-the-employee-onboarding-workflow-automator)
11. [Ecommerce: The Hyper-Personalization Engine](#11-ecommerce-the-hyper-personalization-engine)
12. [Marketing Tech: The Autonomous Campaign Manager](#12-marketing-tech-the-autonomous-campaign-manager)
13. [Sales Tech: The "Intelligent Sales Rep" Assistant](#13-sales-tech-the-intelligent-sales-rep-assistant)
14. [Insurance Tech: The "Automated Claims Adjuster"](#14-insurance-tech-the-automated-claims-adjuster)
15. [Project Management: The "AI Project Manager"](#15-project-management-the-ai-project-manager)

---

## 1. Enterprise Productivity: The AI-Powered Meeting Assistant

**Project Description:** This project aims to develop an AI assistant that transcribes, summarizes, and analyzes meetings. The assistant will join a meeting, provide a real-time transcript, generate a concise summary with action items, and perform sentiment analysis to gauge the meeting's tone. The final output will be stored in a Supabase database and accessible through a React/Next.js interface.

**Features:**
- **Transcription Feature:** Converts spoken language from the meeting into text.
- **Summarization Feature:** Creates a brief overview of the key discussion points.
- **Action Item Feature:** Identifies and extracts actionable tasks and owners.
- **Sentiment Analysis Feature:** Analyzes the text to determine the emotional tone of the meeting.
- **Storage Feature:** Saves the transcription, summary, and analysis to Supabase.

**Workflow:**
- **Sequential-Pipeline:** The workflow follows a clear sequence: transcription, then summarization and sentiment analysis in parallel, followed by action item extraction, and finally, storage.

---

## 2. Code Generation: The "Docs-to-API" Feature

**Project Description:** This tool will read an API documentation page (e.g., Swagger or OpenAPI) and automatically generate client library code in a specified programming language. The user will provide a URL to the documentation, and the features will collaborate to parse, understand, and generate the necessary code.

**Features:**
- **Documentation Parsing Feature:** Scrapes and understands the structure of the API documentation.
- **Endpoint Analysis Feature:** Identifies all the available endpoints, their parameters, and expected responses.
- **Code Generation Feature:** Based on the analysis, generates the client library code.
- **Code Formatting Feature:** Ensures the generated code adheres to the style guidelines of the target language.

**Workflow:**
- **Sequential-Pipeline:** The process flows from parsing the documentation to analyzing endpoints, generating the code, and finally formatting it.

---

## 3. Multi-Modal Document Data Extraction: The "Invoice-to-JSON" Processor

**Project Description:** This project will build a system to extract structured data (e.g., invoice number, date, line items, total amount) from PDF and image-based invoices. The system will handle various invoice templates and use a correction feature to improve accuracy.

**Features:**
- **OCR Feature:** Extracts raw text from the document (PDF or image).
- **Data Extraction Feature:** Identifies and extracts key-value pairs from the raw text.
- **Validation Feature:** Checks the extracted data for correctness and consistency (e.g., sum of line items equals the total).
- **Auto-Correction Feature:** If validation fails, this feature attempts to correct the extracted data by re-analyzing the document or using predefined rules.
- **JSON Formatting Feature:** Converts the final, validated data into a structured JSON format.

**Workflow:**
- An orchestrator workflow feature manages the workflow, passing the document to the OCR feature, then to the extraction feature. It would then invoke the validation and auto-correction features as needed before finally sending the data to the JSON formatting feature.

---

## 4. Healthcare: The "Patient Onboarding" Assistant

**Project Description:** An AI-powered assistant to streamline the patient onboarding process. The system will interact with a new patient through a chat interface to collect their medical history, symptoms, and insurance information. This data will be structured and saved to a secure Supabase database.

**Features:**
- **Patient Interaction Feature (Chatbot):** Engages with the patient to gather information in a conversational manner.
- **Medical Terminology Feature:** Understands and correctly interprets medical terms provided by the patient.
- **Data Structuring Feature:** Organizes the collected information into a standardized patient record format.
- **Database Feature:** Securely stores the structured patient data in Supabase.

**Workflow:**
- An orchestrator manages the conversation flow, engaging the medical terminology feature when needed and passing the final information to the data structuring and database features.

---

## 5. Data Extraction from Poor Quality Images: The "Receipt Digitizer"

**Project Description:** This project focuses on extracting data from low-quality or damaged receipts. The system will enhance the image quality before performing OCR and then use a series of features to piece together and validate the extracted information.

**Features:**
- **Image Enhancement Feature:** Applies filters and transformations to improve the clarity of the receipt image.
- **Advanced OCR Feature:** A specialized OCR feature trained to handle distorted or partially obscured text.
- **Data Assembly Feature:** Takes the fragmented data from the OCR feature and attempts to reconstruct meaningful information (e.g., item names, prices).
- **Correction & Validation Feature:** Cross-references extracted data (e.g., by calculating the total) and flags inconsistencies for manual review.

**Workflow:**
- **Sequential-Pipeline:** The process starts with image enhancement, followed by OCR, data assembly, and finally correction and validation.

---

## 6. HR Tech: The "Resume Screening" Swarm

**Project Description:** An AI system that screens resumes for a specific job description. Multiple features will analyze different aspects of a resume in parallel and collectively decide on the candidate's suitability.

**Features:**
- **Experience Analysis Feature:** Evaluates the candidate's work history against the job requirements.
- **Skills Matching Feature:** Compares the skills listed on the resume with the required skills for the role.
- **Education Verification Feature:** Checks the candidate's educational background.
- **Red Flag Feature:** Looks for potential red flags like job hopping or unexplained gaps in employment.
- **Scoring Feature:** Aggregates the outputs of all other features to provide a final suitability score.

**Workflow:**
- Multiple features work in parallel on the same resume, and their individual assessments are then aggregated by a scoring feature to make a final recommendation.

---

## 7. Enterprise Productivity: The "Internal Knowledge Base" Navigator

**Project Description:** A conversational AI that helps employees find information within the company's internal knowledge base (e.g., Confluence, SharePoint). The AI will understand natural language queries and provide direct answers with links to the source documents.

**Features:**
- **Query Understanding Feature:** Parses the employee's question to determine their intent.
- **Search Feature:** Queries the knowledge base to find relevant documents.
- **Answer Generation Feature:** Reads the relevant documents and formulates a concise answer to the employee's question.
- **Source-Linking Feature:** Provides links to the source documents for further reading.

**Workflow:**
- **Sequential-Pipeline:** The user's query is first understood, then used to search for relevant information, from which an answer is generated and finally presented with source links.

---

## 8. Code Generation: The "Unit Test" Creator

**Project Description:** This tool will analyze a given piece of code (a function or a class) and automatically generate unit tests for it. This will help improve code quality and test coverage.

**Features:**
- **Code Analysis Feature:** Understands the input code, its logic, and its dependencies.
- **Test Case Generation Feature:** Creates a variety of test cases, including edge cases and happy paths.
- **Test Code Writing Feature:** Writes the actual unit test code in a specified testing framework (e.g., Jest, PyTest).
- **Assertion Feature:** Adds relevant assertions to the test code to verify the correctness of the output.

**Workflow:**
- An orchestrator directs the process, first having the code analyzed, then generating test cases, writing the test code, and finally adding assertions.

---

## 9. Multi-Modal Document Data Extraction: The "Contract Analysis" Tool

**Project Description:** A system that can analyze legal contracts (in PDF or DOCX format) to extract key clauses, identify potential risks, and summarize the document.

**Features:**
- **Clause Identification Feature:** Scans the document to identify and categorize different clauses (e.g., termination, liability, confidentiality).
- **Risk Analysis Feature:** Analyzes the identified clauses for potential risks or unfavorable terms.
- **Summarization Feature:** Provides a high-level summary of the contract's key terms.
- **Data Extraction Feature:** Pulls out specific data points like party names, effective dates, and contract value.

**Workflow:**
- Multiple features can work in parallel to analyze different aspects of the contract (clause identification, risk analysis, data extraction), with their findings then compiled into a comprehensive report by a summarization feature.

---

## 10. HR Tech: The "Employee Onboarding" Workflow Automator

**Project Description:** An automated system to manage the employee onboarding process. When a new hire is added, a series of workflows are triggered, from creating accounts to scheduling orientation meetings.

**Features:**
- **New Hire Data Feature:** Gathers the new employee's information from the HR system.
- **IT Provisioning Feature:** Creates necessary accounts (email, Slack, etc.) and requests hardware.
- **Calendar Feature:** Schedules introductory meetings with the manager and team.
- **Documentation Feature:** Sends out links to important onboarding documents and company policies.
- **Notification Feature:** Keeps the new hire, their manager, and HR informed of the onboarding progress.

**Workflow:**
- A central orchestrator feature manages the entire onboarding workflow, triggering the appropriate features at the right time based on the completion of previous steps.

---

## 11. Ecommerce: The Hyper-Personalization Engine

**Project Description:** This project aims to create a multi-feature system that delivers a hyper-personalized shopping experience for users. By analyzing user behavior in real-time, the features will collaboratively tailor product recommendations, promotional offers, and even the website's layout to match individual preferences. The goal is to increase user engagement and conversion rates. The results and user interactions will be stored in Supabase to refine future recommendations.

**Features:**
- **Behavior Tracking Feature:** Monitors and collects data on user interactions, such as clicks, searches, and purchase history.
- **Customer Segmentation Feature:** Groups users into different segments based on their behavior and demographics.
- **Product Recommendation Feature:** Suggests products based on the user's segment and real-time behavior.
- **Dynamic Pricing Feature:** Adjusts product prices and promotions based on demand, user segment, and inventory levels.
- **Content Personalization Feature:** Modifies the website's content and layout to appeal to the individual user.

**Workflow:**
- All features work in parallel, continuously analyzing the user's data and collectively deciding on the best personalization strategy. Their combined insights are used to create a unified and adaptive user experience.

---

## 12. Marketing Tech: The Autonomous Campaign Manager

**Project Description:** This project involves building an AI system that can plan, execute, and optimize a digital marketing campaign from a single high-level instruction. Given a goal, such as "launch a campaign for our new feature," the features will work together to define the target audience, create ad copy and visuals, manage the budget, and monitor performance, making adjustments as needed.

**Features:**
- **Strategic Planner Feature:** Defines the campaign's objectives, target audience, and key messaging.
- **Content Creation Feature:** Generates ad copy, social media posts, and email newsletters.
- **Media Buying Feature:** Selects the best channels for the campaign and manages the ad spend.
- **Performance Analyst Feature:** Tracks key metrics like click-through rates and conversions and provides optimization suggestions.
- **Reporting Feature:** Compiles the campaign results into a comprehensive report for human review.

**Workflow:**
- A central orchestrator feature manages the entire campaign lifecycle. It delegates tasks to the specialized features and ensures they work together cohesively to achieve the campaign's goals.

---

## 13. Sales Tech: The "Intelligent Sales Rep" Assistant

**Project Description:** This AI-powered assistant is designed to boost the productivity of sales representatives by automating administrative tasks and providing real-time insights. The system will listen to sales calls, automatically update the CRM with notes, identify upselling opportunities, and generate follow-up emails.

**Features:**
- **Call Transcription Feature:** Transcribes sales calls in real-time.
- **CRM Automation Feature:** Extracts key information from the transcription and updates the relevant fields in the CRM.
- **Opportunity Spotting Feature:** Analyzes the conversation for buying signals and potential upsell or cross-sell opportunities.
- **Email Generation Feature:** Drafts personalized follow-up emails based on the call's content and outcome.
- **Sales Coach Feature:** Provides feedback to the sales rep on their performance, based on an analysis of the call.

**Workflow:**
- **Sequential-Pipeline:** The workflow follows a logical progression, starting with call transcription, followed by CRM updates and opportunity analysis, and concluding with email generation and coaching feedback.

---

## 14. Insurance Tech: The "Automated Claims Adjuster"

**Project Description:** This project aims to build a multi-feature system that automates the initial stages of the insurance claims process. When a policyholder submits a claim (e.g., for a minor car accident), the system will verify the policy, assess the damage from photos, check for fraudulent signals, and, for simple cases, approve the claim for payout.

**Features:**
- **Policy Verification Feature:** Confirms that the claimant's policy is active and covers the reported incident.
- **Damage Assessment Feature:** Uses computer vision to analyze photos of the damage and estimate the repair costs.
- **Fraud Detection Feature:** Scans the claim for any signs of fraud by cross-referencing it with historical data.
- **Claims Adjudication Feature:** Based on the inputs from the other features, decides whether to approve, deny, or escalate the claim for human review.
- **Customer Communication Feature:** Keeps the policyholder informed about the status of their claim via email or SMS.

**Workflow:**
- An orchestrator feature manages the claims process from start to finish. It directs the flow of information between the other features and makes the final decision on how to proceed with the claim.

---

## 15. Project Management: The "AI Project Manager"

**Project Description:** An AI-powered project manager that can oversee a project from inception to completion. Given a project goal, the system will break it down into tasks, assign them to team members (or other AI features), monitor progress, and provide regular status updates to stakeholders.

**Features:**
- **Planning Feature:** Creates a detailed project plan, including tasks, deadlines, and dependencies.
- **Resource Allocation Feature:** Assigns tasks to the most suitable team members based on their skills and availability.
- **Progress Tracking Feature:** Monitors the completion of tasks and updates the project timeline accordingly.
- **Risk Assessment Feature:** Identifies potential risks and suggests mitigation strategies.
- **Communication Feature:** Sends regular progress reports to stakeholders and facilitates communication between team members.

**Workflow:**
- A central orchestrator, or "Supervisor Feature," oversees the entire project. It delegates responsibilities to the other features and ensures that the project stays on track and within budget.
