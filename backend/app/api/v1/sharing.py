"""Public sharing: tokenized share links, public pages, embeds, OG previews."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.api.v1.serializers import analysis_to_out
from app.core.deps import get_current_user
from app.database import get_db
from app.models import Event, Race, ShareLink, User
from app.schemas.ecosystem import ShareCreate, ShareOut

router = APIRouter(prefix="/share", tags=["sharing"])

_VALID = {"race", "event", "athlete"}


def _share_url(token: str) -> str:
    return f"/s/{token}"


@router.post("", response_model=ShareOut)
def create_share(body: ShareCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if body.resource_type not in _VALID:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid resource_type")
    link = ShareLink(
        resource_type=body.resource_type, resource_id=body.resource_id,
        created_by=user.id, allow_embed=body.allow_embed,
    )
    db.add(link)
    db.commit()
    db.refresh(link)
    return ShareOut(
        token=link.token, url=_share_url(link.token), resource_type=link.resource_type,
        resource_id=link.resource_id, allow_embed=link.allow_embed, views=link.views,
    )


def _get_link(token: str, db: Session) -> ShareLink:
    link = db.query(ShareLink).filter(ShareLink.token == token, ShareLink.is_active.is_(True)).one_or_none()
    if link is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Share link not found or revoked")
    return link


@router.get("/{token}")
def resolve_share(token: str, db: Session = Depends(get_db)):
    """Public, unauthenticated resolution of a shared resource."""
    link = _get_link(token, db)
    link.views += 1
    db.commit()

    if link.resource_type == "race":
        race = db.get(Race, link.resource_id)
        if not race or not race.analysis:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Shared race not available")
        return {
            "type": "race",
            "race": {"id": race.id, "name": race.name, "discipline": race.discipline},
            "analysis": analysis_to_out(race.analysis, race).model_dump(),
            "allow_embed": link.allow_embed,
        }
    if link.resource_type == "event":
        event = db.get(Event, link.resource_id)
        if not event:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Shared event not available")
        ea = event.analysis
        return {
            "type": "event",
            "event": {"id": event.id, "name": event.name, "slug": event.slug},
            "leaderboards": ea.leaderboards if ea else {},
            "stats": ea.stats if ea else {},
            "allow_embed": link.allow_embed,
        }
    # athlete
    from app.models import Athlete
    athlete = db.get(Athlete, link.resource_id)
    if not athlete:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Shared athlete not available")
    return {
        "type": "athlete",
        "athlete": {"id": athlete.id, "display_name": athlete.display_name, "handle": athlete.handle},
        "allow_embed": link.allow_embed,
    }


@router.get("/{token}/og-image.svg")
def og_preview(token: str, db: Session = Depends(get_db)):
    """Social-media optimized preview image (SVG) generated from the resource."""
    link = _get_link(token, db)
    title = "RouteForge"
    subtitle = ""
    if link.resource_type == "race":
        race = db.get(Race, link.resource_id)
        if race:
            title = race.name
            if race.analysis and race.analysis.metrics:
                m = race.analysis.metrics
                subtitle = f"{m.get('distance_m',0)/1000:.1f} km · {int(m.get('duration_s',0)//60)} min"
    elif link.resource_type == "event":
        event = db.get(Event, link.resource_id)
        if event:
            title = event.name
            subtitle = "Event results & replay"
    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <rect width="1200" height="630" fill="#0f172a"/>
  <text x="60" y="120" fill="#38bdf8" font-family="sans-serif" font-size="34">RouteForge</text>
  <text x="60" y="320" fill="#ffffff" font-family="sans-serif" font-size="72" font-weight="bold">{_xml_escape(title)[:36]}</text>
  <text x="60" y="400" fill="#94a3b8" font-family="sans-serif" font-size="40">{_xml_escape(subtitle)}</text>
</svg>"""
    return Response(content=svg, media_type="image/svg+xml")


def _xml_escape(s: str) -> str:
    return (s or "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
