from flask import Flask, jsonify, request, abort
from flask_cors import CORS
import pyodbc
import pandas as pd
import numpy as np
import re
from autots import AutoTS
import os
import json
import logging
import smtplib
from email.mime.text import MIMEText
from openai import AzureOpenAI
import requests
import msal
import os, logging
from exchangelib import (
    OAuth2Credentials, Configuration, Account,
    Message, Mailbox, DELEGATE      # we don’t impersonate here
)
from exchangelib import Message, Mailbox
from exchangelib import Body as EwsBody

app = Flask(__name__)
CORS(app)

# Database connection details
SERVER = "10.0.40.20"
DATABASE = "MLDataWareHouse"
USERNAME = "DEV_TANISH"
PASSWORD = "Tanish@@1606$$"

CONN_STR = (
    "DRIVER={SQL Server};"
    f"SERVER={SERVER};"
    f"DATABASE={DATABASE};"
    f"UID={USERNAME};"
    f"PWD={PASSWORD}"
)

# Azure OpenAI configuration - values read from environment variables
AZURE_ENDPOINT = os.environ.get("AZURE_OPENAI_ENDPOINT")
AZURE_KEY = os.environ.get("AZURE_OPENAI_KEY")
AZURE_API_VERSION = os.environ.get("AZURE_OPENAI_API_VERSION", "2024-02-15-preview")
AZURE_DEPLOYMENT = os.environ.get("AZURE_OPENAI_DEPLOYMENT", "gpt-4o-mini")

client = AzureOpenAI(
    azure_endpoint='https://bimal-m3yb3ir8-swedencentral.cognitiveservices.azure.com/',
    api_key='4yYIcw9jOQQFzkpct0czTxaS56Y7SkPRSxbvifLQVAFkekIlTrIaJQQJ99AKACfhMk5XJ3w3AAAAACOGyoY6',
    api_version="2024-12-01-preview"
)

logging.basicConfig(
    filename="backend.log",
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s - %(message)s"
)

logger = logging.getLogger(__name__)

def _get_graph_token() -> str:
    """Acquire an app-only access token for Microsoft Graph."""
    tenant_id   = "12bd9b63-46f8-4092-a420-8df6f60703f7"          # ← directory ID
    client_id   = "85604b62-daff-49be-baf8-babb4a86c689"          # ← app registration
    client_secret = "0jN8Q~f6mp9iO95QhYpkpTcoOcqeOEO5HdAfNaSz"    # ← client secret

    if not all([tenant_id, client_id, client_secret]):
        raise RuntimeError("Graph email is not configured: "
                           "AZURE_TENANT_ID / AZURE_CLIENT_ID / AZURE_CLIENT_SECRET")

    authority = f"https://login.microsoftonline.com/{tenant_id}"
    app = msal.ConfidentialClientApplication(
        client_id, authority=authority, client_credential=client_secret
    )
    result = app.acquire_token_for_client(scopes=["https://graph.microsoft.com/.default"])
    if "access_token" not in result:
        raise RuntimeError(f"Token acquisition failed: {result.get('error_description')}")
    return result["access_token"]

def send_email(to_addr: str, subject: str, body: str) -> None:
    """
    Send a plain-text email via Microsoft Graph.

    Env-vars required
    -----------------
    AZURE_TENANT_ID        Directory (tenant) ID
    AZURE_CLIENT_ID        App-registration (client) ID
    AZURE_CLIENT_SECRET    Client secret
    EMAIL_SENDER           Mailbox you’re sending *from* (e.g. bot@contoso.com)
    """
    sender = os.getenv("EMAIL_SENDER")
    if not sender:
        logger.warning("EMAIL_SENDER not set; skipping email")
        return

    # 1) Get bearer token
    try:
        token = _get_graph_token()
    except Exception as exc:
        logger.warning("Graph auth failed; email not sent: %s", exc)
        return

    # 2) Build Graph payload
    graph_endpoint = f"https://graph.microsoft.com/v1.0/users/{sender}/sendMail"
    email_msg = {
        "message": {
            "subject": subject,
            "body": {
                "contentType": "Text",
                "content": body
            },
            "toRecipients": [
                {"emailAddress": {"address": to_addr}}
            ]
        },
        # Save a copy in the sender’s Sent Items
        "saveToSentItems": "true"
    }

    # 3) POST to Graph
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }

    resp = requests.post(graph_endpoint, headers=headers, json=email_msg, timeout=30)

    if resp.status_code == 202:
        logger.info("Email sent to %s", to_addr)
    else:
        logger.warning("Failed to send email (%s): %s", resp.status_code, resp.text)

# def send_email(to_addr: str, subject: str, body: str) -> None:
#     """Send an email if SMTP configuration is available."""
#     server = os.environ.get("SMTP_SERVER")
#     if not server:
#         logger.warning("SMTP server not configured; skipping email")
#         return
#     port = int(os.environ.get("SMTP_PORT", "25"))
#     user = os.environ.get("SMTP_USER")
#     password = os.environ.get("SMTP_PASSWORD")
#     from_addr = os.environ.get("SMTP_FROM", "no-reply@example.com")

#     msg = MIMEText(body)
#     msg["Subject"] = subject
#     msg["From"] = from_addr
#     msg["To"] = to_addr

#     try:
#         with smtplib.SMTP(server, port) as smtp:
#             if user and password:
#                 smtp.starttls()
#                 smtp.login(user, password)
#             smtp.send_message(msg)
#     except Exception as exc:
#         logger.warning("Failed to send email: %s", exc)

def ensure_account_comments_schema() -> None:
    """Ensure AccountComments table has needed columns."""
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("SELECT COL_LENGTH('AccountComments','PeriodYear')")
        length = cur.fetchone()[0]
        if length is not None and length < 50:
            cur.execute(
                "ALTER TABLE AccountComments ALTER COLUMN PeriodYear VARCHAR(50) NOT NULL"
            )
            conn.commit()

        cur.execute(
            "SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='AccountComments' AND COLUMN_NAME='FinalComment'"
        )
        exists = cur.fetchone()
        if not exists:
            cur.execute(
                "ALTER TABLE AccountComments ADD FinalComment NVARCHAR(MAX) NULL"
            )
            conn.commit()
    except Exception as exc:
        logger.warning("Schema check failed: %s", exc)
    finally:
        conn.close()

def ensure_monthly_comments_schema() -> None:
    """Ensure Monthly_Comments table has needed columns."""
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            "SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='Monthly_Comments' AND COLUMN_NAME='ApprovedSummary'"
        )
        exists = cur.fetchone()
        if not exists:
            cur.execute(
                "ALTER TABLE Monthly_Comments ADD ApprovedSummary TEXT NULL"
            )
            conn.commit()
    except Exception as exc:
        logger.warning("Monthly schema check failed: %s", exc)
    finally:
        conn.close()

# Default prompts for the AI comment generation
AGENT1_PROMPT = """
    You are a financial analyst specialized in quantitative reasoning. Your task is to analyze the performance of a Profit and Loss (P&L) account over the last three months. You are given one main account (either aggregated or non-aggregated), along with the month-wise absolute values and corresponding percentage values (e.g., as a % of Total Revenue). If the account is aggregated, it includes multiple subaccounts, each with their respective monthly values and % contributions. You must:
1. Quantify the month-over-month change in both absolute terms and percentage terms for the overall account across each month transition (e.g., Oct → Nov, Nov → Dec).
2. If it's an aggregated account, also:
    - Break down the individual contribution of each subaccount to the overall change in value and percentage.
    - Highlight the top contributors to increase or decrease.
    - Identify the dominant subaccounts.
    - Analyse period over period changes in absolute figures as well as percentage figures and highlight the growth or decline
3. Your output must be purely quantitative. Do not include any interpretations or business reasons.
4. Focus on sustained trends, inflection points, or unusual fluctuations.
5. Detect Inverse Relationships - Absolute Growth but declining % share, to highlight business mix evolution or revenue diversification.
6. Use comparative phrases like early periods, later periods or specific months. Also use qualitative descriptors like mid-80s, high-70s, etc. for % ranges. Ensure the comment is narrative in nature.
7. Ensure the comments follow SEC MD&A and FASB standards.
    """
AGENT2_PROMPT = """
    You are a CFO-level strategic financial advisor. Your task is to analyze a Profit and Loss (P&L) account based on both - The quantitative output provided by Agent 1 (showing changes in values and percentages), and, The raw financial data (showing monthly performance of the main account and its subaccounts, if any). The output must:
    1. Interpret the changes (growth, decline, or stagnancy) in the account using financial reasoning and business logic.
    2. Explain why the changes might have occurred — using observable patterns such as - Shifts in subaccount contributions, Volatility in sales channels (e.g., Retail or Delivery), Discount trends, Changes in cost efficiency (for expense accounts). Explain why a particular subaccount grew/shrank or gained/lost share in terms of strategy, operations or consumer signals.
    3. Suggest strategic insights and forward-looking recommendations to improve or sustain performance.
    4. If the account is aggregated: Comment on the relative performance of subaccounts and diversification of revenue or cost sources. Mention if any subaccounts are dragging or accelerating the overall performance.
    5. Offer Explanations that align with the changes observed in the quantitative summary, do no repeat the number, focus on what the shifts mean.
    6. Avoid Speculations unless clearly implied by the data.
    7. Use phrases such as - Business Mix Evolution, Operational Resilience, Expense Control is improving, Consumer demand signal remains strong,e tc.
    8. End each paragraph with a practical recommendation.
Standards to follow:
    1. Use decisive and precise language — avoid vague terms like "may", "perhaps", "possibly".
    2. Use percentages as your primary basis for comparison (not raw numbers), since this aligns with financial reporting standards (ICAI, CFA, ACCA).
    3. Your commentary should be actionable and CFO-grade.
Avoid the following words, phrases and topics in the final comments. STRICTLY PROHIBIT THESE WORDS, IN NO CASE THE FOLLOWING WORDS ARE TO BE USED. NEVER COMMENT ON "Supplier Renegotiations"
    === PROHIBITED TOPICS & THEMES FOR P&L COMMENTARY ===

1. SPECULATIVE CUSTOMER PSYCHOLOGY
- repeat business from regular clientele
- must-have treat
- impulse purchases
- customers engage with delivery options
- customer willingness to absorb pricing
- fluctuating consumer tastes
- evolving consumer preferences

2. INTERNAL OPERATIONAL ADJUSTMENTS / ACCOUNTING PRACTICES
- internal accounting adjustment
- zero balance suggests an operational model
- prioritizes lean inventory practices
- bypassing the complexities of carrying forward
- simplifying financial reporting
- focus on current period performance
- Menu Item pricing

3. STRATEGIC GUESSWORK / HYPOTHETICAL BUSINESS DECISIONS
- strategic recalibration
- might justify
- suggests a temporary pullback
- ongoing investment in e-commerce optimization
- prompting an evaluation
- tailored strategies to leverage each segment

4. PROMOTIONAL OR MARKETING LANGUAGE
- enhancing the guest experience
- contributing to customer loyalty
- premium provider
- culinary expertise
- artisanal food market
- impressive gross profit growth
- high-quality, locally sourced ingredients

5. FORWARD-LOOKING PROJECTIONS WITHOUT DATA
- potential of this segment as an area for growth
- positions the café for ongoing financial stability
- transitioning to profitability indicates sustained financial health
- might be a lucrative niche
- continued improvements will solidify profitability

6. EXCESSIVE MICRO-LEVEL COST OPTIMIZATION DISCUSSION
- reductions in subscription fees and POS charges
- vendor negotiations
- reduced obligations in Federal FUTA
- modest Social Security and Medicare percentages
- stable medical insurance figures
- minimal turnover

=== SUMMARY OF BANNED CONTENT AREAS ===
- Customer behavior assumptions
- Back-office or accounting mechanics
- Hypothetical strategy talk
- Promotional/branding language
- Unbacked future outlooks
- Line-level operational expenses (non-material)

"""
AGENT3_PROMPT = """
    You are a senior financial communication specialist. Your role is to combine the outputs of:
    1. Agent 1: who has provided a purely quantitative breakdown of changes in values and percentages for the main account and its subaccounts.
    2. Agent 2: who has provided strategic reasoning, interpretation, and actionable recommendations based on the same data.
    Your goal is to:
        - Integrate both outputs smoothly, ensuring the final result reads like a unified and natural financial commentary — not two stitched-together sections.
        - Maintain the factual precision of Agent 1’s numbers without repeating them verbatim.
        - Preserve the strategic depth and reasoning from Agent 2, tying it clearly to the underlying quantitative trends.
        - Use professional, CFO-grade tone, language, and phrasing appropriate for inclusion in a boardroom-level financial report.
    Guidelines:
    - Do not copy Agent 1 and Agent 2 comments as-is.
    - You may paraphrase or rephrase, but all facts must remain accurate.
    - Use clear transitions (e.g., "This was largely driven by...", "However, a closer look reveals...").
    - Include at least one strategic recommendation or implication near the end.
    - Prioritize fluency and professionalism — it should read like a final, polished commentary.
    Avoid the following words, phrases and topics in the final comments. STRICTLY PROHIBIT THE FOLLOWING WORDS IRRESPECTIVE OF ANYTHING. IN NO CASE THE FOLLOWING WORDS ARE TO BE USED. NEVER COMMENT ON "Supplier Renegotiations"
    === PROHIBITED TOPICS & THEMES FOR P&L COMMENTARY ===

1. SPECULATIVE CUSTOMER PSYCHOLOGY
- repeat business from regular clientele
- must-have treat
- impulse purchases
- customers engage with delivery options
- customer willingness to absorb pricing
- fluctuating consumer tastes
- evolving consumer preferences

2. INTERNAL OPERATIONAL ADJUSTMENTS / ACCOUNTING PRACTICES
- internal accounting adjustment
- zero balance suggests an operational model
- prioritizes lean inventory practices
- bypassing the complexities of carrying forward
- simplifying financial reporting
- focus on current period performance
- Menu Item Pricing

3. STRATEGIC GUESSWORK / HYPOTHETICAL BUSINESS DECISIONS
- strategic recalibration
- might justify
- suggests a temporary pullback
- ongoing investment in e-commerce optimization
- prompting an evaluation
- tailored strategies to leverage each segment

4. PROMOTIONAL OR MARKETING LANGUAGE
- enhancing the guest experience
- contributing to customer loyalty
- premium provider
- culinary expertise
- artisanal food market
- impressive gross profit growth
- high-quality, locally sourced ingredients

5. FORWARD-LOOKING PROJECTIONS WITHOUT DATA
- potential of this segment as an area for growth
- positions the café for ongoing financial stability
- transitioning to profitability indicates sustained financial health
- might be a lucrative niche
- continued improvements will solidify profitability

6. EXCESSIVE MICRO-LEVEL COST OPTIMIZATION DISCUSSION
- reductions in subscription fees and POS charges
- vendor negotiations
- reduced obligations in Federal FUTA
- modest Social Security and Medicare percentages
- stable medical insurance figures
- minimal turnover

=== SUMMARY OF BANNED CONTENT AREAS ===
- Customer behavior assumptions
- Back-office or accounting mechanics
- Hypothetical strategy talk
- Promotional/branding language
- Unbacked future outlooks
- Line-level operational expenses (non-material)

In addition to the list provided, following is also a list of prohibited topics which you must refrain from using in the comments.
    1. Don’t suggest operational changes such as reducing portions or switching vendors or cutting back on staff
    2. Avoid personal opinions or emotions: “This seems like too much.” Or “I don’t think this is working.”
    3. Don’t assume mistakes like “someone overspent here” or “This looks wrong”
    4. Don’t use vague statements with no numbers such as “Sales were good.”
    5. Don’t repeat things that are already obvious: “Total sales were $95,000.”
    6. Don’t use excuses or speculation: “Labor was high, probably due to people calling out.”
    7. Don’t blame assignments - “Inventory was mishandled.”
    8. Don’t use too much detail on small expenses or on no expense. Skip it unless small expenses accumulate into a noticeable change.
    9. We Can not suggest client that they should implement new marketing strategies or should tell them to implement marketing initiatives.
    10. We should not comment on how the client offers his guest hospitality and increase customer loyalty.
    11. We should not comment on the targeted strategy, product strategy & dining experience.
    12. We should not judge the potential of the client and its decision or strategy formed by the management.
    13. No judgements on seasonal changes and client preferences & other market competitors.
    14. Strategies based on every category should not be commented on.
    15. We should not say or judge on vendor negotiations or vendor management or re negotiations of service contracts
    16. Market varies from time to time hence we should not comment on marketing strategies or marketing expenditure.
    17. No comment on organization policies.
    18. Based on the numbers we should not comment on contraction or expansion, also we cannot judge the business model shift, hence no random judgements.
    """
AGENT6_PROMPT = """
You are a senior financial summarizer. Your job is to reduce the following financial commentary into exactly 3 concise sentences without losing key strategic and financial meaning. Keep tone professional, and make sure all key points are preserved. You also have to ensure that the summary is free from any prohibited topics or phrases. The prohibited topics are:
    1. Don’t suggest operational changes such as reducing portions or switching vendors or cutting back on staff
    2. Avoid personal opinions or emotions: “This seems like too much.” Or “I don’t think this is working.”
    3. Don’t assume mistakes like “someone overspent here” or “This looks wrong”
    4. Don’t use vague statements with no numbers such as “Sales were good.”
    5. Don’t repeat things that are already obvious: “Total sales were $95,000.”
    6. Don’t use excuses or speculation: “Labor was high, probably due to people calling out.”
    7. Don’t blame assignments - “Inventory was mishandled.”
    8. Don’t use too much detail on small expenses or on no expense. Skip it unless small expenses accumulate into a noticeable change.
    9. We Can not suggest client that they should implement new marketing strategies or should tell them to implement marketing initiatives.
    10. We should not comment on how the client offers his guest hospitality and increase customer loyalty.
    11. We should not comment on the targeted strategy, product strategy & dining experience.
    12. We should not judge the potential of the client and its decision or strategy formed by the management.
    13. No judgements on seasonal changes and client preferences & other market competitors.
    14. Strategies based on every category should not be commented on.
    15. We should not say or judge on vendor negotiations or vendor management or re negotiations of service contracts
    16. Market varies from time to time hence we should not comment on marketing strategies or marketing expenditure.
    17. No comment on organization policies.
    18. Based on the numbers we should not comment on contraction or expansion, also we cannot judge the business model shift, hence no random judgements.
    For a better understanding, you will also be provided with the outputs of Company Specific Instruction, Agent 1, Agent 2 which are the Company Specific Instructions, quantitative summary, strategic reasoning respectively.
    """
CHAT_INSTRUCTION = """
You are a senior financial assistant trained to support multi-turn conversations on Profit and Loss (P&L) accounts. You have access to prior financial outputs, including raw account-level data, quantitative change summaries, strategic reasoning, and final commentary. In this ongoing conversation, your role is to interpret, clarify, and answer user questions about the financial performance in a professional, SEC MD&A-compliant tone.

Your behavior must reflect the following roles:
1. As a financial analyst: Provide quantitative insights (month-over-month changes in absolute and percentage terms, contribution analysis of subaccounts, inflection points, inverse trends).
2. As a CFO-level strategist: Interpret the shifts using business reasoning (channel changes, cost structure evolution, subaccount volatility), and provide forward-looking recommendations.
3. As a financial communicator: Deliver responses in fluent, unified language that reflects boardroom-grade professionalism.
4. As a summarizer: When asked, condense long analyses into 2–3 precise strategic takeaways without losing fidelity.

Guidelines:
- Use prior conversation as full context; refer back to earlier comments or questions where needed.
- Always use factual, data-aligned language. Percentages are preferred for analysis, not raw numbers.
- Highlight significant growth/decline trends, dominant contributors, and changes in revenue mix.
- Do not speculate, assume intent, or invent justifications without evidence.
- Use transitions like “A closer look shows…”, “This was largely driven by…”, etc., to guide reasoning flow.
- Maintain separation of fact and recommendation: do not mix numerical changes with strategic advice unless asked.
- Avoid repetition of previous responses unless restating for clarity or emphasis.

Strictly avoid:
❌ Customer psychology (e.g., "impulse purchases", "customer loyalty")
❌ Internal accounting language (e.g., "zero balance", "simplified reporting")
❌ Hypothetical decisions or management intent
❌ Promotional branding language (e.g., "premium provider", "high-quality ingredients")
❌ Unbacked future projections or vague outlooks (e.g., “positions the café for...”, “may grow...”)
❌ Micro-cost level detail unless they accumulate into a material change
❌ Suggestions related to vendor negotiations, operational staffing, menu pricing, or customer experience
❌ Opinions, speculation, blame, or judgment (e.g., “this seems wrong”, “someone overspent”, “mistake”)

Always prioritize clarity, financial logic, and data-aligned responses. Your objective is to make P&L analysis actionable and intelligible without overstepping into guesswork or brand speak.
"""

def run_azure_llm(system_prompt: str, user_input_text: str, max_tokens: int = 800) -> str:
    if client is None:
        logger.error("Azure OpenAI client not configured")
        return ""
    full_prompt = f"### Instruction:\n{system_prompt}\n\n### Input:\n{user_input_text}\n\n### Response:"
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "You are a helpful financial assistant."},
            {"role": "user", "content": full_prompt},
        ],
        max_tokens=max_tokens,
        temperature=0.3,
        top_p=0.8,
    )
    return response.choices[0].message.content.strip()

def run_azure_llm_chat(
    chat_history: list,
    user_message: str,
    system_prompt: str = CHAT_INSTRUCTION,
    company_instructions: str = "",
) -> str:
    """Run the Azure OpenAI model in chat mode with history and optional company instructions."""
    if client is None:
        logger.error("Azure OpenAI client not configured")
        return ""

    messages = [{"role": "system", "content": system_prompt}]
    if company_instructions:
        messages.append({"role": "system", "content": company_instructions})
    for msg in chat_history:
        role = msg.get("role")
        content = msg.get("content")
        if role and content:
            messages.append({"role": role, "content": content})
    messages.append({"role": "user", "content": user_message})

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=messages,
        temperature=0.3,
        top_p=0.8,
    )
    return response.choices[0].message.content.strip()

def agent_1_generate_quantitative(data_json_str: str) -> str:
    return run_azure_llm(AGENT1_PROMPT, data_json_str)

def agent_2_generate_reasoning(data_json_str: str, comp_data: str, quantitative_summary: str) -> str:
    input_with_summary = (
        f"Company Specific Data:\n{comp_data}\n\nQuantitative Summary:\n{quantitative_summary}\n\nP&L JSON:\n{data_json_str}"
    )
    return run_azure_llm(AGENT2_PROMPT, input_with_summary)

def agent_3_generate_final_comment(quantitative_summary: str, reasoning_text: str, comp_data: str, data_json_str: str) -> str:
    input_combined = (
        f"Company Specific Instruction:\n{comp_data}\n\nQuantitative Summary:\n{quantitative_summary}\n\nStrategic Reasoning:\n{reasoning_text}\n\nP&L JSON:\n{data_json_str}"
    )
    return run_azure_llm(AGENT3_PROMPT, input_combined)

def agent_6_summarize_comment(comment_text: str, agent1_output: str, agent2_output: str, comp_data: str) -> str:
    input_combined = (
        f"Company Specific Instruction:\n{comp_data}\n\nQuantitative Summary:\n{agent1_output}\n\nStrategic Reasoning:\n{agent2_output}\n\nFinal Commentary:\n{comment_text}"
    )
    return run_azure_llm(AGENT6_PROMPT, input_combined, max_tokens=500)

def get_connection():
    return pyodbc.connect(CONN_STR)

# ----- Forecast SQL Templates -----
SQL_INCOME = """
SELECT  a.year,
        a.Period,
        SUM(a.amount) AS Amount
FROM    qbsyncdb_merge.dbo.QBD_PLTransactionData a
JOIN    Pchase_DocManager_Merge.dbo.ERPGLMst b
      ON a.CompanyCode = b.CompanyCode
     AND a.GLCode     = b.AccountNumber
WHERE   a.category     = 'pl'
  AND   a.CompanyCode  = ?
  AND   a.SiteCode     = ?
  AND   b.AccountType  = 'Income'
  AND  (a.year <  ? OR (a.year = ? AND CAST(a.Period AS INT) < ?))
  AND   a.year > 2022
GROUP BY a.year, a.Period
ORDER BY a.year, a.Period;
"""

SQL_COGS = SQL_INCOME.replace("b.AccountType  = 'Income'", "b.AccountType  = 'CostOfGoodsSold'")

SQL_EXPENSE = """
SELECT  c.year,
        c.period    AS Period,
        SUM(c.Amount) AS Amount
FROM    MLDataWarehouse.dbo.pl_master            a
JOIN    QBSyncDB_Merge.dbo.QBD_PLTransactionData c
      ON a.CompanyCode = c.CompanyCode
     AND a.GLCode     = c.GLCode
WHERE   a.CompanyCode = ?
  AND   c.SiteCode    = ?
  AND   CAST(a.GrandParentCode AS INT) >
        (SELECT CAST(GrandParentCode AS INT)
           FROM MLDataWarehouse.dbo.pl_master
          WHERE CompanyCode = ? AND LineItem = 'GROSS PROFIT')
  AND   CAST(a.GrandParentCode AS INT) <
        (SELECT CAST(GrandParentCode AS INT)
           FROM MLDataWarehouse.dbo.pl_master
          WHERE CompanyCode = ? AND LineItem = 'EBITDA')
  AND   a.IsAggregated <> 1
  AND  (c.year <  ? OR (c.year = ? AND CAST(c.period AS INT) < ?))
  AND   c.year > 2022
GROUP BY c.year, c.period
ORDER BY c.year, c.period;
"""

def load_timeseries(sql: str, params: list):
    df = pd.read_sql(sql, get_connection(), params=params)
    if df.empty:
        abort(404, "No historical data before the requested cut-off.")
    df["Period"] = df["Period"].astype(int)
    df = df[df["Period"].between(1, 12)]
    df["date"] = pd.to_datetime(
        df["year"].astype(str) + "-" + df["Period"].astype(str).str.zfill(2) + "-01"
    )
    return df[["date", "Amount"]].sort_values("date").reset_index(drop=True)

def forecast_next_3_months(df: pd.DataFrame):
    model = AutoTS(
        forecast_length=3,
        frequency="MS",
        prediction_interval=0.9,
        ensemble="horizontal",
        model_list="superfast",
        max_generations=5,
        validation_method="backwards",
    ).fit(df, date_col="date", value_col="Amount")

    fc = model.predict().forecast.reset_index()
    fc.columns = ["date", "forecast"]
    fc["date"] = fc["date"].dt.strftime("%Y-%m-%d")
    return fc.to_dict(orient="records")

def load_existing_forecast(field: str, company: str, site: str, year: int, period: int):
    conn = get_connection()
    sql = (
        "SELECT Forecasted_For_Year, Forecasted_For_Period, Forecasted_Value, Approved_Value "
        "FROM ForecastMonthly "
        "WHERE Field=? AND CompanyCode=? AND SiteCode=? "
        "AND Forecasted_On_Year=? AND Forecasted_On_Period=?"
    )
    df = pd.read_sql(sql, conn, params=[field, company, site, year, f"P{period}"])
    conn.close()
    if df.empty:
        return None
    df["PeriodInt"] = df["Forecasted_For_Period"].str.extract(r"P(\d+)").astype(int)
    df["date"] = pd.to_datetime(
        df["Forecasted_For_Year"].astype(int).astype(str)
        + "-"
        + df["PeriodInt"].astype(str).str.zfill(2)
        + "-01"
    )
    df = df.sort_values("date")
    df["date"] = df["date"].dt.strftime("%Y-%m-%d")
    df.rename(
        columns={"Forecasted_Value": "forecast", "Approved_Value": "approved"},
        inplace=True,
    )
    return df[["date", "forecast", "approved"]].to_dict(orient="records")

def save_forecast(field: str, fc: list[dict], company: str, site: str, year: int, period: int):
    conn = get_connection()
    cur = conn.cursor()
    for row in fc:
        dt = pd.to_datetime(row["date"])
        cur.execute(
            "INSERT INTO ForecastMonthly (Field, Forecasted_Value, Forecasted_On_Period, Forecasted_On_Year, Forecasted_For_Period, Forecasted_For_Year, CompanyCode, SiteCode) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            field,
            row["forecast"],
            f"P{period}",
            year,
            f"P{dt.month}",
            dt.year,
            company,
            site,
        )
    conn.commit()
    conn.close()

def make_forecast_endpoint(sql_template: str, company_dupes: int = 0):
    def _endpoint():
        company = request.args.get("company")
        site = request.args.get("site")
        year = request.args.get("year", type=int)
        # ---- robust period parser ----
        raw_period = request.args.get("period")          # get it as-is
        if raw_period is None:
            abort(400, "'period' query param is required")

        m = re.search(r"\d+", str(raw_period))           # grab the digits
        if not m:
            abort(400, f"Invalid period value: {raw_period}")
        period = int(m.group())                          # e.g. "P03" -> 3
        # --------------------------------

        if not all([company, site, year, period]):
            abort(400, "Query params 'company', 'site', 'year', 'period' are required.")
        if not (1 <= period <= 12):
            abort(400, "'period' must be 1-12")

        field = (
            "Income" if sql_template is SQL_INCOME else "COGS" if sql_template is SQL_COGS else "Expense"
        )

        existing = load_existing_forecast(field, company, site, year, period)
        if existing is not None:
            return jsonify(forecast=existing, message="Forecast already generated")

        params = [company, site] + [company] * company_dupes + [year, year, period]
        df = load_timeseries(sql_template, params)
        fc = forecast_next_3_months(df)
        for row in fc:
            row["approved"] = None
        save_forecast(field, fc, company, site, year, period)
        return jsonify(forecast=fc)

    return _endpoint

# Register forecast endpoints
app.add_url_rule("/forecast/income", "forecast_income", make_forecast_endpoint(SQL_INCOME, 0))
app.add_url_rule("/forecast/cogs", "forecast_cogs", make_forecast_endpoint(SQL_COGS, 0))
app.add_url_rule("/forecast/expense", "forecast_expense", make_forecast_endpoint(SQL_EXPENSE, 2))

# ----- Actuals Endpoints -----
def make_actuals_endpoint(sql_template: str, company_dupes: int = 0):
    def _endpoint():
        company = request.args.get("company")
        site = request.args.get("site")
        year = request.args.get("year", type=int)
        raw_period = request.args.get("period")
        if raw_period is None:
            abort(400, "'period' query param is required")

        m = re.search(r"\d+", str(raw_period))
        if not m:
            abort(400, f"Invalid period value: {raw_period}")
        period = int(m.group())

        if not all([company, site, year, period]):
            abort(400, "Query params 'company', 'site', 'year', 'period' are required.")
        if not (1 <= period <= 12):
            abort(400, "'period' must be 1-12")

        params = [company, site] + [company] * company_dupes + [year, year, period]
        df = load_timeseries(sql_template, params)
        df["date"] = df["date"].dt.strftime("%Y-%m-%d")
        df.rename(columns={"Amount": "actual"}, inplace=True)
        return jsonify(actuals=df.to_dict(orient="records"))

    return _endpoint

app.add_url_rule("/forecast/income_actuals", "forecast_income_actuals", make_actuals_endpoint(SQL_INCOME, 0))
app.add_url_rule("/forecast/cogs_actuals", "forecast_cogs_actuals", make_actuals_endpoint(SQL_COGS, 0))
app.add_url_rule("/forecast/expense_actuals", "forecast_expense_actuals", make_actuals_endpoint(SQL_EXPENSE, 2))


@app.route('/forecast/approve', methods=['POST'])
def approve_forecast():
    data = request.get_json() or {}
    company_code = data.get('company_code')
    site_code = data.get('site_code')
    year = data.get('year')
    period = data.get('period')
    entries = data.get('entries', [])
    user = data.get('user', 'AI.Admin')
    import re                                   # (already imported at top of file)

    # --- normalise "P6", "p06", 6, etc. into an int ----------------------------
    m = re.search(r'\d+', str(period))          # pull out the digits
    if not m:
        return jsonify({'error': 'Bad period format'}), 400
    period_int = int(m.group())                 # e.g. "P6" -> 6
    # ---------------------------------------------------------------------------


    if not all([company_code, site_code, year, period, entries]):
        return jsonify({'error': 'Missing parameters'}), 400

    conn = get_connection()
    cur = conn.cursor()
    for row in entries:
        date = row.get('date')
        if not date:
            continue
        dt = pd.to_datetime(date)
        for key, field in [('income', 'Income'), ('cogs', 'COGS'), ('expense', 'Expense')]:
            val = row.get(key)
            if val is None:
                continue
            cur.execute(
                'UPDATE ForecastMonthly SET Approved_Value=?, Forecast_ApprovedBy=?, '
                'Forecast_ApprovedOn=SYSUTCDATETIME() WHERE CompanyCode=? AND SiteCode=? '
                'AND Field=? AND Forecasted_On_Year=? AND Forecasted_On_Period=? '
                'AND Forecasted_For_Year=? AND Forecasted_For_Period=?',
                (
                    val,
                    user,
                    company_code,
                    site_code,
                    field,
                    int(year),
                    f'P{int(period_int)}',
                    dt.year,
                    f'P{dt.month}',
                ),
            )
    conn.commit()
    conn.close()
    return jsonify({'status': 'approved'})


@app.route('/company_codes', methods=['GET'])
def get_company_codes():
    conn = get_connection()
    cur = conn.cursor()
    cur.execute('SELECT DISTINCT CompanyCode FROM PL_Master')
    rows = cur.fetchall()
    conn.close()
    codes = [row[0] for row in rows]
    return jsonify({'company_codes': codes})

@app.route('/site_codes', methods=['GET'])
def get_site_codes():
    company_code = request.args.get('company_code')
    if not company_code:
        return jsonify({'error': 'company_code parameter required'}), 400
    conn = get_connection()
    cur = conn.cursor()
    cur.execute('SELECT DISTINCT SiteCode FROM PL_Master WHERE CompanyCode = ?', (company_code,))
    rows = cur.fetchall()
    conn.close()
    codes = [row[0] for row in rows]
    return jsonify({'site_codes': codes})

@app.route('/accounts', methods=['GET'])
def get_accounts():
    company_code = request.args.get('company_code')
    site_code = request.args.get('site_code')

    conn = get_connection()
    cur = conn.cursor()

    query = 'SELECT DISTINCT GLCode, UniqueID, LineItem, IsAggregated FROM PL_Master'
    params = []
    conditions = []
    if company_code:
        conditions.append('CompanyCode = ?')
        params.append(company_code)
    if site_code:
        conditions.append('SiteCode = ?')
        params.append(site_code)
    if conditions:
        query += ' WHERE ' + ' AND '.join(conditions)
    query += ' ORDER BY GLCode'

    cur.execute(query, params)
    rows = cur.fetchall()
    conn.close()

    accounts = [
        {
            'value': str(row[0]).strip(),
            'label': f"{row[0]} - {row[1]} - {row[2]}",
            'uniqueId': str(row[1]).strip(),
            'isAggregated': bool(row[3]) if row[3] is not None else False
        }
        for row in rows
    ]

    return jsonify({'accounts': accounts})


def generate_account_json_structured_percentage(account_number: str, df: pd.DataFrame, acc_to_desc_map) -> dict:
    account_df = df[df["AccountNumber"] == account_number]
    if account_df.empty:
        return {"error": "Account number not found."}

    acc_row = account_df.iloc[0]
    is_aggregated = acc_row["IsAggregated"]
    account_type = acc_row.get("AccountType", "Other")
    sub_account = acc_row.get("Description", "")
    percentage_formula = acc_row.get("PercentageFormula", "")

    percentage_denominator = []
    if "{/}" in percentage_formula:
        _, denom_expr = percentage_formula.split("{/}", 1)
        components = re.split(r'\{\+\}|\{\-\}', denom_expr)
        for comp in components:
            gl_code = comp.split("\\")[-1].strip()
            if gl_code:
                percentage_denominator.append({
                    "GLCode": gl_code,
                    "Description": acc_to_desc_map.get(gl_code, "Unknown")
                })

    result = {
        "Account_Type": account_type,
        "SubAccount": sub_account,
        "Aggregated": str(is_aggregated),
        "Percentage Field": {
            "Denominator Accounts": percentage_denominator
        },
    }

    for period in df["Period"].unique():
        period_data = df[
            (df["AccountNumber"] == account_number) & (df["Period"] == period)
        ]
        if not period_data.empty:
            amount = period_data.iloc[0]["TotalAmount"]
            pct = period_data.iloc[0]["PercentageValue"]
            result[f"P{period}-{acc_row['Year']}"] = amount
            result[f"P{period}-{acc_row['Year']} %"] = pct

    if is_aggregated:
        formula = acc_row.get("AggregatedFormula", "")
        if not formula or pd.isna(formula):
            result["Aggregated Accounts"] = "No Linked Accounts"
            result["Aggregated Fields"] = "No Linked Accounts"
            return result

        tokens = re.split(r'\{\+\}|\{\-\}', formula)
        subaccount_codes = [tok.split("\\")[-1] for tok in tokens if tok.strip()]
        linked_accounts = df[df["AccountNumber"].isin(subaccount_codes)]

        result["Aggregated Accounts"] = ",".join(linked_accounts["Description"].unique())
        agg_fields = []

        for acc_code in subaccount_codes:
            acc_rows = df[df["AccountNumber"] == acc_code]
            if acc_rows.empty:
                continue
            row = acc_rows.iloc[0]
            pct_formula = row.get("PercentageFormula", "")
            pct_denominator = []
            if "{/}" in pct_formula:
                _, denom_expr = pct_formula.split("{/}", 1)
                components = re.split(r'\{\+\}|\{\-\}', denom_expr)
                for comp in components:
                    gl_code = comp.split("\\")[-1].strip()
                    if gl_code:
                        pct_denominator.append({
                            "GLCode": gl_code,
                            "Description": acc_to_desc_map.get(gl_code, "Unknown")
                        })
            entry = {
                "Account_Type": row.get("AccountType", "Other"),
                "SubAccount": row.get("Description", ""),
                "Percentage Field": {
                    "Denominator Accounts": pct_denominator
                },
            }
            for period in df["Period"].unique():
                period_row = acc_rows[acc_rows["Period"] == period]
                if not period_row.empty:
                    entry[f"P{period}-{row['Year']}"] = period_row.iloc[0]["TotalAmount"]
                    entry[f"P{period}-{row['Year']} %"] = period_row.iloc[0]["PercentageValue"]
            agg_fields.append(entry)

        result["Aggregated Fields"] = agg_fields
    else:
        result["Aggregated Accounts"] = "No Linked Accounts"
        result["Aggregated Fields"] = "No Linked Accounts"

    return result


def default_func(company_code, site_code, year, periods):
    df_final = pd.DataFrame()
    for period in periods:
        def compute_aggregated_value(account):
            if account in computed_cache:
                return computed_cache[account]
            formula = formula_lookup.get(account)
            if not formula or pd.isna(formula):
                return None
            components = re.split(r'(\{\+\}|\{\-\})', formula)
            expression = ""
            for comp in components:
                if comp == "{+}":
                    expression += "+"
                elif comp == "{-}":
                    expression += "-"
                else:
                    acc_code = comp.split("\\")[-1]
                    if acc_code not in amount_lookup or pd.isna(amount_lookup[acc_code]):
                        value = compute_aggregated_value(acc_code)
                    else:
                        value = amount_lookup[acc_code]
                    value = 0 if value is None else value
                    expression += str(value)
            try:
                result = eval(expression)
                computed_cache[account] = result
                return result
            except Exception:
                return None

        def compute_percentage_value(account):
            formula = percentage_formula_lookup.get(account)
            if not formula or pd.isna(formula):
                return None
            if '{/}' in formula:
                numerator_part, denominator_part = formula.split('{/}')
            else:
                return None

            def eval_expr(expr):
                components = re.split(r'(\{\+\}|\{\-\})', expr)
                expression = ""
                for comp in components:
                    if comp == "{+}":
                        expression += "+"
                    elif comp == "{-}":
                        expression += "-"
                    else:
                        acc_code = comp.split("\\")[-1]
                        value = amount_lookup.get(acc_code)
                        value = 0 if value is None else value
                        expression += str(value)
                return eval(expression)

            try:
                numerator = eval_expr(numerator_part)
                denominator = eval_expr(denominator_part)
                if denominator == 0:
                    return 0
                return round((numerator / denominator) * 100, 2)
            except Exception:
                return None

        query = f"""
        WITH GLHierarchy AS (
            SELECT ERPGLCode AS CurrentGLCode, Description, AccountNumber,
                    AccountType, Category, Sublevel, ParentGLCode,
                    CAST(Description AS NVARCHAR(MAX)) AS IndentedDescription,
                    0 AS SortOrder, CAST(ERPGLCode AS NVARCHAR(MAX)) AS HierarchyPath
            FROM Pchase_DocManager_Merge.dbo.ERPGLMst
            WHERE Sublevel=0 AND CompanyCode='{company_code}' AND IsActive=1 AND Category='PL'
            UNION ALL
            SELECT c.ERPGLCode, c.Description, c.AccountNumber, c.AccountType,
                    c.Category, c.Sublevel, c.ParentGLCode,
                    CAST(REPLICATE(N' ',c.Sublevel)+c.Description AS NVARCHAR(MAX)),
                    p.SortOrder+1, CAST(p.HierarchyPath+ '>'+c.ERPGLCode AS NVARCHAR(MAX))
            FROM Pchase_DocManager_Merge.dbo.ERPGLMst c
            JOIN GLHierarchy p ON c.ParentGLCode=p.CurrentGLCode
            WHERE c.CompanyCode='{company_code}' AND c.IsActive=1 AND c.Category='PL'
        ), TxnSummary AS (
            SELECT CompanyCode,SiteCode,Year,Period,GLCode, SUM(Amount) AS TotalAmount
            FROM QBSyncDB_Merge.dbo.QBD_PLTransactionData
            WHERE Year={year} AND Period={period} AND CompanyCode='{company_code}'
            GROUP BY CompanyCode,SiteCode,Year,Period,GLCode
        )
        SELECT GH.*, TS.CompanyCode, TS.SiteCode, TS.Year, TS.Period, TS.TotalAmount
        FROM GLHierarchy GH
        LEFT JOIN TxnSummary TS ON GH.AccountNumber=TS.GLCode
        ORDER BY GH.HierarchyPath, GH.AccountType, GH.AccountNumber;
        """

        conn_str = (
            f"DRIVER={{SQL Server}};"
            f"SERVER={SERVER};DATABASE={DATABASE};"
            f"UID={USERNAME};PWD={PASSWORD};TrustServerCertificate=yes;"
        )
        conn = pyodbc.connect(conn_str)
        conn_str2 = (
                f"DRIVER={{SQL Server}};"
                f"SERVER={SERVER};DATABASE=MLDataWarehouse;"
                f"UID={USERNAME};PWD={PASSWORD};TrustServerCertificate=yes;"
            )
        conn2 = pyodbc.connect(conn_str2)
        QUERY2 = f"""SELECT UniqueID, GLCode, LineItem, IsAggregated, AggregatedFormula, PercentageFormula FROM PL_Master WHERE CompanyCode='{company_code}'"""
        dfp = pd.read_sql(query, conn)
        dfp["Sublevel"] = pd.to_numeric(dfp["Sublevel"], errors="coerce").fillna(0).astype(int)
        dfp["SiteCode"] = dfp["SiteCode"].fillna(site_code)
        dfp["CompanyCode"] = dfp["CompanyCode"].fillna(company_code)
        dfp["Year"] = pd.to_numeric(dfp["Year"], errors="coerce").fillna(year).astype(int)
        dfp["Period"] = pd.to_numeric(dfp["Period"], errors="coerce").fillna(period).astype(int)
        dfp["TotalAmount"] = pd.to_numeric(dfp["TotalAmount"], errors="coerce").fillna(0)
        master_df = pd.read_sql(QUERY2, conn2)
        output_df = dfp.copy()
        master_glcodes = set(master_df['GLCode'].dropna().astype(str))
        output_accounts = set(output_df['AccountNumber'].dropna().astype(str))
        missing_glcodes = master_glcodes - output_accounts
        missing_rows = master_df[master_df['GLCode'].astype(str).isin(missing_glcodes)]
        new_records = pd.DataFrame(columns=output_df.columns)
        new_records['AccountNumber'] = missing_rows['GLCode'].astype(str)
        new_records['Description'] = missing_rows['LineItem']
        new_records['TotalAmount'] = None
        new_records['IsAggregated'] = missing_rows['IsAggregated']
        new_records['AggregatedFormula'] = missing_rows['AggregatedFormula']
        for col in output_df.columns:
            if col not in new_records.columns:
                new_records[col] = None
        final_df = pd.concat([output_df, new_records], ignore_index=True)
        amount_lookup = dict(zip(final_df['AccountNumber'].astype(str), final_df['TotalAmount']))
        formula_lookup = dict(zip(final_df['AccountNumber'].astype(str), final_df['AggregatedFormula'].astype(str)))
        computed_cache = {}
        for idx, row in final_df[final_df['TotalAmount'].isna()].iterrows():
            acct = str(row['AccountNumber'])
            try:
                value = compute_aggregated_value(acct)
                final_df.at[idx, 'TotalAmount'] = value
            except Exception:
                final_df.at[idx, 'TotalAmount'] = None
        final_df['TotalAmount'] = final_df['TotalAmount'].round(0)
        columns_to_drop = ['SortOrder', 'CurrentGLCode', 'ParentGLCode', 'HierarchyPath', 'IndentedDescription']
        final_df = final_df.drop(columns=columns_to_drop, errors='ignore')
        percentage_formula_map = dict(zip(master_df['GLCode'].astype(str), master_df['PercentageFormula']))
        master_glcodes = set(master_df['GLCode'].dropna().astype(str))
        output_accounts = set(final_df['AccountNumber'].dropna().astype(str))
        missing_glcodes = master_glcodes - output_accounts
        missing_rows = master_df[master_df['GLCode'].astype(str).isin(missing_glcodes)]
        new_records = pd.DataFrame(columns=final_df.columns)
        new_records['AccountNumber'] = missing_rows['GLCode'].astype(str)
        new_records['Description'] = missing_rows['LineItem']
        new_records['TotalAmount'] = None
        new_records['IsAggregated'] = missing_rows['IsAggregated']
        new_records['AggregatedFormula'] = missing_rows['AggregatedFormula']
        for col in final_df.columns:
            if col not in new_records.columns:
                new_records[col] = None
        final_df = pd.concat([final_df, new_records], ignore_index=True)
        final_df['PercentageFormula'] = final_df['AccountNumber'].astype(str).map(percentage_formula_map)
        amount_lookup = dict(zip(final_df['AccountNumber'].astype(str), final_df['TotalAmount']))
        percentage_formula_lookup = dict(zip(final_df['AccountNumber'].astype(str), final_df['PercentageFormula'].astype(str)))
        final_df['PercentageValue'] = final_df['AccountNumber'].astype(str).apply(compute_percentage_value)
        no_percentage_accounts = final_df[final_df['PercentageFormula'].isna() | (final_df['PercentageFormula'] == '')]['AccountNumber'].unique()
        final_df = final_df[~final_df['AccountNumber'].isin(no_percentage_accounts)]
        final_df["SiteCode"] = final_df["SiteCode"].fillna(site_code)
        final_df["CompanyCode"] = final_df["CompanyCode"].fillna(company_code)
        final_df["Year"] = pd.to_numeric(final_df["Year"], errors="coerce").fillna(year).astype(int)
        final_df["Period"] = pd.to_numeric(final_df["Period"], errors="coerce").fillna(period).astype(int)
        final_df['UniqueID'] = final_df['AccountNumber'].astype(str).map(dict(zip(master_df['GLCode'].astype(str), master_df['UniqueID'])))
        final_df['Record_ID'] = final_df.apply(
            lambda row: f"{row['UniqueID']}_{row['Period']}_{row['Year']}" if pd.notna(row['UniqueID']) else None,
            axis=1
        )
        final_df['AccountType'] = final_df['AccountType'].fillna('Aggregated')
        final_df['Category'] = final_df['Category'].fillna('PL')
        final_df['Sublevel'] = final_df['Sublevel'].fillna(0).astype(int)
        df_final = pd.concat([df_final, final_df], ignore_index=True)
        conn.close()
        conn2.close()

        period_check = df_final.groupby('AccountNumber')['Period'].nunique()
        accounts_to_check = period_check[period_check >= len(periods)].index.tolist()

        zero_accounts = []
        for acc in accounts_to_check:
            subset = df_final[df_final['AccountNumber'] == acc]
            if all(v in [0, 0.0, None, np.nan] for v in subset['TotalAmount']):
                zero_accounts.append(acc)

        df_final = df_final[~df_final['AccountNumber'].isin(zero_accounts)]

        def drop_zero_from_formula(formula, zero_accounts):
            if not isinstance(formula, str) or not formula.strip():
                return formula
            components = re.split(r'(\{\+\}|\{\-\})', formula)
            cleaned = []
            for comp in components:
                if comp in ["{+}", "{-}"]:
                    cleaned.append(comp)
                else:
                    acc = comp.split("\\")[-1]
                    if acc not in zero_accounts:
                        cleaned.append(comp)
            return ''.join(cleaned).strip()

        df_final['AggregatedFormula'] = df_final['AggregatedFormula'].apply(lambda x: drop_zero_from_formula(x, zero_accounts))
        df_final['PercentageFormula'] = df_final['PercentageFormula'].apply(lambda x: drop_zero_from_formula(x, zero_accounts))
    return df_final


@app.route('/account_summary', methods=['POST'])
def account_summary():
    data = request.get_json() or {}
    company_code = data.get('company_code')
    site_code = data.get('site_code')
    year = data.get('year')
    periods = data.get('periods', [])
    account_number = data.get('account_number')

    if not all([company_code, site_code, year, periods, account_number]):
        return jsonify({'error': 'Missing parameters'}), 400

    df_final = default_func(company_code, site_code, year, periods)
    acc_to_desc_map = dict(zip(df_final["AccountNumber"].astype(str), df_final["Description"]))
    summary = generate_account_json_structured_percentage(account_number, df_final, acc_to_desc_map)
    return jsonify({'summary': summary})


@app.route('/generate_comment', methods=['POST'])
def generate_comment():
    data = request.get_json() or {}
    account_json = data.get('account_json')
    comp_data = data.get('company_info', '')
    if account_json is None:
        return jsonify({'error': 'account_json parameter required'}), 400

    data_json_str = json.dumps(account_json, indent=4)
    agent1_output = agent_1_generate_quantitative(data_json_str)
    agent2_output = agent_2_generate_reasoning(data_json_str, comp_data, agent1_output)
    final_comment = agent_3_generate_final_comment(agent1_output, agent2_output, comp_data, data_json_str)
    summary = agent_6_summarize_comment(final_comment, agent1_output, agent2_output, comp_data)

    return jsonify({'summary': summary, 'final_comment': final_comment})


def sort_periods(periods):
    def parse(p):
        pnum, year = p.split('-')
        return int(year), int(pnum.replace('P', ''))

    return sorted(periods, key=parse)


@app.route('/comments', methods=['GET'])
def get_comment():
    account_id = request.args.get('account_id')
    company_code = request.args.get('company_code')
    site_code = request.args.get('site_code')
    periods = request.args.get('periods')
    if not all([account_id, company_code, site_code, periods]):
        return jsonify({'error': 'Missing parameters'}), 400

    period_list = sort_periods(periods.split(','))
    period_str = ','.join(period_list)
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        'SELECT OriginalComment, FinalComment, ApprovedComment, ApprovedBy, ApprovedOn FROM AccountComments WHERE AccountID=? AND CompanyCode=? AND SiteCode=? AND PeriodYear=?',
        (account_id, company_code, site_code, period_str)
    )
    row = cur.fetchone()
    conn.close()
    if row:
        logger.info('Returning stored comment for %s %s %s %s', account_id, company_code, site_code, period_str)
        approved_on = row[4]
        if approved_on and hasattr(approved_on, 'isoformat'):
            approved_on = approved_on.isoformat()
        return jsonify({
            'summary': row[0],
            'final_comment': row[1],
            'approved_comment': row[2],
            'approved_by': row[3],
            'approved_on': approved_on
        })
    else:
        return jsonify({'comment': None})


@app.route('/comments/generate', methods=['POST'])
def generate_account_comment():
    data = request.get_json() or {}
    account_id = data.get('account_id')
    company_code = data.get('company_code')
    site_code = data.get('site_code')
    periods = data.get('periods', [])
    account_json = data.get('account_json')
    comp_data = data.get('company_info', '')

    if not all([account_id, company_code, site_code, periods, account_json]):
        return jsonify({'error': 'Missing parameters'}), 400

    period_list = sort_periods(periods)
    period_str = ','.join(period_list)

    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        'SELECT OriginalComment, FinalComment FROM AccountComments WHERE AccountID=? AND CompanyCode=? AND SiteCode=? AND PeriodYear=?',
        (account_id, company_code, site_code, period_str)
    )
    row = cur.fetchone()
    if row:
        conn.close()
        logger.info('Existing comment returned for %s %s %s %s', account_id, company_code, site_code, period_str)
        return jsonify({'summary': row[0], 'final_comment': row[1] or row[0]})

    data_json_str = json.dumps(account_json, indent=4)
    agent1_output = agent_1_generate_quantitative(data_json_str)
    agent2_output = agent_2_generate_reasoning(data_json_str, comp_data, agent1_output)
    final_comment = agent_3_generate_final_comment(agent1_output, agent2_output, comp_data, data_json_str)
    summary = agent_6_summarize_comment(final_comment, agent1_output, agent2_output, comp_data)

    cur.execute(
        'INSERT INTO AccountComments (AccountID, CompanyCode, SiteCode, PeriodYear, OriginalComment, FinalComment) VALUES (?, ?, ?, ?, ?, ?)',
        (account_id, company_code, site_code, period_str, summary, final_comment)
    )
    conn.commit()
    conn.close()

    logger.info('Generated and stored comment for %s %s %s %s', account_id, company_code, site_code, period_str)
    return jsonify({'summary': summary, 'final_comment': final_comment})


@app.route('/comments/regenerate', methods=['POST'])
def regenerate_account_comment():
    data = request.get_json() or {}
    account_id = data.get('account_id')
    company_code = data.get('company_code')
    site_code = data.get('site_code')
    periods = data.get('periods', [])
    account_json = data.get('account_json')
    comp_data = data.get('company_info', '')

    if not all([account_id, company_code, site_code, periods, account_json]):
        return jsonify({'error': 'Missing parameters'}), 400

    period_list = sort_periods(periods)
    period_str = ','.join(period_list)

    data_json_str = json.dumps(account_json, indent=4)
    agent1_output = agent_1_generate_quantitative(data_json_str)
    agent2_output = agent_2_generate_reasoning(data_json_str, comp_data, agent1_output)
    final_comment = agent_3_generate_final_comment(agent1_output, agent2_output, comp_data, data_json_str)
    summary = agent_6_summarize_comment(final_comment, agent1_output, agent2_output, comp_data)

    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        'SELECT COUNT(*) FROM AccountComments WHERE AccountID=? AND CompanyCode=? AND SiteCode=? AND PeriodYear=?',
        (account_id, company_code, site_code, period_str)
    )
    exists = cur.fetchone()[0] > 0
    if exists:
        cur.execute(
            'UPDATE AccountComments SET OriginalComment=?, FinalComment=?, CreatedOn=SYSUTCDATETIME() WHERE AccountID=? AND CompanyCode=? AND SiteCode=? AND PeriodYear=?',
            (summary, final_comment, account_id, company_code, site_code, period_str)
        )
    else:
        cur.execute(
            'INSERT INTO AccountComments (AccountID, CompanyCode, SiteCode, PeriodYear, OriginalComment, FinalComment) VALUES (?, ?, ?, ?, ?, ?)',
            (account_id, company_code, site_code, period_str, summary, final_comment)
        )
    conn.commit()
    conn.close()

    logger.info('Regenerated comment for %s %s %s %s', account_id, company_code, site_code, period_str)
    return jsonify({'summary': summary, 'final_comment': final_comment})


@app.route('/comments/approve', methods=['POST'])
def approve_account_comment():
    data = request.get_json() or {}
    account_id = data.get('account_id')
    company_code = data.get('company_code')
    site_code = data.get('site_code')
    periods = data.get('periods', [])
    comment = data.get('comment')
    user = data.get('user', 'AI.Admin')

    if not all([account_id, company_code, site_code, periods, comment]):
        return jsonify({'error': 'Missing parameters'}), 400

    period_list = sort_periods(periods)
    period_str = ','.join(period_list)

    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        'UPDATE AccountComments SET ApprovedComment=?, ApprovedOn=SYSUTCDATETIME(), ApprovedBy=? WHERE AccountID=? AND CompanyCode=? AND SiteCode=? AND PeriodYear=?',
        (comment, user, account_id, company_code, site_code, period_str)
    )
    conn.commit()
    conn.close()
    logger.info('Approved comment for %s %s %s %s by %s', account_id, company_code, site_code, period_str, user)
    return jsonify({'status': 'approved'})

@app.route('/followup_chat', methods=['POST'])
def followup_chat():
    data = request.get_json() or {}
    user_message = data.get('message')
    history = data.get('history', [])
    comp_data = data.get('company_info', '')
    if not user_message:
        return jsonify({'error': 'message parameter required'}), 400

    reply = run_azure_llm_chat(
        history,
        user_message,
        system_prompt=CHAT_INSTRUCTION,
        company_instructions=comp_data,
    )
    return jsonify({'reply': reply})


# ----- Monthly Analysis Endpoints -----

@app.route('/monthly/company_codes', methods=['GET'])
def get_monthly_company_codes():
    """Return distinct company codes for monthly analysis."""
    conn = get_connection()
    cur = conn.cursor()
    cur.execute('SELECT DISTINCT CompanyCode FROM Monthly_Master')
    rows = cur.fetchall()
    conn.close()
    codes = [row[0] for row in rows]
    return jsonify({'company_codes': codes})


@app.route('/monthly/site_codes', methods=['GET'])
def get_monthly_site_codes():
    company_code = request.args.get('company_code')
    if not company_code:
        return jsonify({'error': 'company_code parameter required'}), 400
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        'SELECT DISTINCT SiteCode FROM Monthly_Master WHERE CompanyCode = ?',
        (company_code,)
    )
    rows = cur.fetchall()
    conn.close()
    codes = [row[0] for row in rows]
    return jsonify({'site_codes': codes})


@app.route('/monthly/comment', methods=['GET'])
def get_monthly_comment():
    company_code = request.args.get('company_code')
    site_code = request.args.get('site_code')
    year = request.args.get('year')
    period = request.args.get('period')

    if not all([company_code, site_code, year, period]):
        return jsonify({'error': 'Missing parameters'}), 400

    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        'SELECT MonthlySummary, ApprovedSummary, ApprovedBy, ApprovedOn '
        'FROM Monthly_Comments WHERE CompanyCode=? AND SiteCode=? AND Year=? AND Period=?',
        (company_code, site_code, year, period),
    )
    row = cur.fetchone()
    conn.close()
    if row:
        approved_on = row[3]
        if approved_on and hasattr(approved_on, 'isoformat'):
            approved_on = approved_on.isoformat()
        return jsonify({
            'monthly_summary': row[0],
            'approved_summary': row[1],
            'approved_by': row[2],
            'approved_on': approved_on,
        })
    return jsonify({'comment': None})


@app.route('/monthly/comment/update', methods=['POST'])
def update_monthly_comment():
    data = request.get_json() or {}
    company_code = data.get('company_code')
    site_code = data.get('site_code')
    year = data.get('year')
    period = data.get('period')
    summary = data.get('monthly_summary')

    if not all([company_code, site_code, year, period, summary]):
        return jsonify({'error': 'Missing parameters'}), 400

    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        'SELECT COUNT(*) FROM Monthly_Comments WHERE CompanyCode=? AND SiteCode=? AND Year=? AND Period=?',
        (company_code, site_code, year, period),
    )
    exists = cur.fetchone()[0] > 0
    if exists:
        cur.execute(
            'UPDATE Monthly_Comments SET MonthlySummary=?, CreatedOn=SYSUTCDATETIME() '
            'WHERE CompanyCode=? AND SiteCode=? AND Year=? AND Period=?',
            (summary, company_code, site_code, year, period),
        )
    else:
        cur.execute(
            'INSERT INTO Monthly_Comments (CompanyCode, SiteCode, Year, Period, MonthlySummary) '
            'VALUES (?, ?, ?, ?, ?)',
            (company_code, site_code, year, period, summary),
        )
    conn.commit()
    conn.close()
    logger.info('Saved monthly comment for %s %s %s %s', company_code, site_code, year, period)
    return jsonify({'status': 'saved'})


@app.route('/monthly/comment/approve', methods=['POST'])
def approve_monthly_comment():
    data = request.get_json() or {}
    company_code = data.get('company_code')
    site_code = data.get('site_code')
    year = data.get('year')
    period = data.get('period')
    summary = data.get('summary')
    user = data.get('user', 'AI.Admin')

    if not all([company_code, site_code, year, period, summary]):
        return jsonify({'error': 'Missing parameters'}), 400

    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        'UPDATE Monthly_Comments SET ApprovedSummary=?, ApprovedOn=SYSUTCDATETIME(), '
        'ApprovedBy=? WHERE CompanyCode=? AND SiteCode=? AND Year=? AND Period=?',
        (summary, user, company_code, site_code, year, period),
    )
    conn.commit()
    conn.close()
    logger.info('Approved monthly comment for %s %s %s %s by %s', company_code, site_code, year, period, user)
    return jsonify({'status': 'approved'})


@app.route('/monthly/followup_chat', methods=['POST'])
def monthly_followup_chat():
    data = request.get_json() or {}
    user_message = data.get('message')
    history = data.get('history', [])
    comp_data = data.get('company_info', '')
    if not user_message:
        return jsonify({'error': 'message parameter required'}), 400

    reply = run_azure_llm_chat(
        history,
        user_message,
        system_prompt=CHAT_INSTRUCTION,
        company_instructions=comp_data,
    )
    return jsonify({'reply': reply})


@app.route('/monthly/regenerate_request', methods=['POST'])
def monthly_regenerate_request():
    data = request.get_json() or {}
    company_code = data.get('company_code')
    site_code = data.get('site_code')
    year = data.get('year')
    period = data.get('period')
    email = data.get('email')
    reason = data.get('reason')

    if not all([company_code, site_code, year, period, email, reason]):
        return jsonify({'error': 'Missing parameters'}), 400

    logger.info(
        'Monthly regenerate request from %s for %s %s %s %s: %s',
        email,
        company_code,
        site_code,
        year,
        period,
        reason,
    )

    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        'INSERT INTO RegenerationRequests (CompanyCode, SiteCode, Period, Year, Email, RegenerationRequestReason, RegenerationRequestOpenedBy) '
        'VALUES (?, ?, ?, ?, ?, ?, ?)',
        (company_code, site_code, period, year, email, reason, email),
    )
    conn.commit()
    conn.close()

    send_email(
        to_addr=email,
        subject='Monthly Analysis Regeneration Request',
        body=f'Your request for Monthly Comment regeneration was received and will be processed shortly. Please find the details below:\n\n Company Code: {company_code}\nSite Code: {site_code}\nYear: {year}\nPeriod: {period}\nReason: {reason}\n\nThank you for your patience, AI Support will shortly contact you.',
    )

    send_email(
        to_addr="AISupport@paperchase.ac",
        subject='Monthly Analysis Regeneration Request',
        body=f'A regeneration request has been submitted with the following details:\n\n Company Code: {company_code}\nSite Code: {site_code}\nYear: {year}\nPeriod: {period}\nReason: {reason}\nContact: {email}\n\nPlease review and process the request as soon as possible.',
    )

    return jsonify({'status': 'request submitted'})

if __name__ == '__main__':
    ensure_account_comments_schema()
    ensure_monthly_comments_schema()
    app.run()
