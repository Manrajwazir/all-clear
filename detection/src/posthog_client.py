"""Process-wide PostHog client for the detection service."""

import atexit
import os

from posthog import Posthog


def initialize_posthog() -> Posthog | None:
    """Create the shared PostHog client when analytics is configured."""
    project_token = os.getenv("POSTHOG_PROJECT_TOKEN")
    host = os.getenv("POSTHOG_HOST")

    for variable_name, value in (
        ("POSTHOG_PROJECT_TOKEN", project_token),
        ("POSTHOG_HOST", host),
    ):
        if value:
            continue

        if os.getenv("ENVIRONMENT", "development").lower() != "production":
            raise RuntimeError(
                f"{variable_name} variable required by PostHog is missing or "
                "un-configured, this causes events to be silently missed. This "
                f"error stops appearing once {variable_name} is configured"
            )
        return None

    posthog_client = Posthog(
        project_token,
        host=host,
        enable_exception_autocapture=True,
    )
    atexit.register(posthog_client.shutdown)
    return posthog_client
