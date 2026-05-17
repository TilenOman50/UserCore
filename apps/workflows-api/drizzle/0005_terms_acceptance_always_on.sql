UPDATE "identity_verification_sub_step"
SET "enabled" = true, "valid" = true, "updated_at" = now()
WHERE "type" = 'terms-acceptance';
