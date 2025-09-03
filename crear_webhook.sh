#!/bin/bash
curl -X POST https://api.clickup.com/api/v2/webhook \
  -H "Authorization: Bearer 158426612_90431d450f39f94b8a802f54a2f0c45e898d82c1f41bedbd650fb3ba4649e7ac" \
  -H "Content-Type: application/json" \
  -d '{"endpoint": "https://smee.io/meKdYxyKaQmbgBP", "events": ["taskUpdated"], "list_id": "901208339450"}'
