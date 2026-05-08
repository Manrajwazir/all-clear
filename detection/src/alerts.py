"""
alerts.py
---------
Sends SMS alerts via Twilio and email digests via AWS SES.

SMS = urgent, real-time. Email = end-of-day summary.
Construction supervisors don't check email during the workday. SMS gets read.

Interview prep:
  - "Why SMS over email?" → Supervisors are on the floor, not at a desk.
  - "What if Twilio is down?" → Fail silently with a log. Production needs
    queue + retry. Acknowledged as a known gap.
  - "Why not SQS?" → Premature complexity. Direct call works at <100 violations/min.
    Add SQS when scale demands it.

Cost: $0.0075 USD per SMS to Canadian numbers.
50 violations/day = $0.40/day = $12/month per customer.
"""

import os
import logging
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)


# ---------- Twilio SMS ----------

def get_twilio_client():
    """Create and return a Twilio client."""
    from twilio.rest import Client
    return Client(
        os.environ["TWILIO_ACCOUNT_SID"],
        os.environ["TWILIO_AUTH_TOKEN"]
    )


def send_violation_sms(violation_type: str, camera_name: str, image_url: str) -> str:
    """
    Send an SMS alert for a detected violation.
    Returns the Twilio message SID.

    Note: Trial Twilio numbers prepend "Sent from a Twilio trial account"
    to every SMS. Upgrade to paid before showing to customers.
    """
    try:
        client = get_twilio_client()
        body = (
            f"[All Clear] {violation_type.replace('_', ' ').upper()} "
            f"at {camera_name} — view: {image_url[:50]}..."
        )
        message = client.messages.create(
            body=body,
            from_=os.environ["TWILIO_FROM_NUMBER"],
            to=os.environ["TWILIO_TO_NUMBER"]
        )
        logger.info(f"SMS sent: {message.sid}")
        return message.sid
    except Exception as e:
        # Fail silently with a log — production needs queue + retry
        logger.error(f"Failed to send SMS: {e}")
        return None


# ---------- AWS SES Email Digests ----------

def get_ses_client():
    """Create and return a boto3 SES client."""
    import boto3
    return boto3.client("ses", region_name=os.environ.get("AWS_REGION", "ca-central-1"))


def send_daily_digest(to_email: str, html_body: str):
    """
    Send a daily compliance summary email.

    Note: SES starts in sandbox mode — can only send to verified emails.
    For demo, verify your own + co-founder's email.
    For pilot customer, request production access (24-48h AWS review).
    """
    try:
        ses = get_ses_client()
        ses.send_email(
            Source="alerts@allclear.app",  # must be verified in SES
            Destination={"ToAddresses": [to_email]},
            Message={
                "Subject": {"Data": "[All Clear] Daily Compliance Summary"},
                "Body": {"Html": {"Data": html_body}}
            }
        )
        logger.info(f"Daily digest sent to {to_email}")
    except Exception as e:
        logger.error(f"Failed to send digest: {e}")


# Quick test — run this file directly to send a test SMS
if __name__ == "__main__":
    send_violation_sms("no_helmet", "Camera 1", "https://example.com")
