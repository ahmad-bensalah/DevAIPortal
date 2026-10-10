{{- define "environment.platform" -}}
{{- $platform := .Files.Get "files/platform.yaml" | fromYaml -}}
{{- $platform | toYaml -}}
{{- end -}}

{{- define "environment.namespace" -}}
{{- $platform := .Files.Get "files/platform.yaml" | fromYaml -}}
{{- printf "%s-%s" $platform.namespaces.prefix .Values.name -}}
{{- end -}}

{{- define "environment.labels" -}}
app.kubernetes.io/name: {{ .Values.name }}
app.kubernetes.io/instance: {{ .Values.name }}
app.kubernetes.io/managed-by: ArgoCD
devaiportal.io/managed: "true"
devaiportal.io/blueprint: {{ .Values.blueprint }}
devaiportal.io/owner: {{ .Values.owner | quote }}
devaiportal.io/team: {{ .Values.team }}
devaiportal.io/size: {{ .Values.size }}
{{- end -}}

{{- define "environment.annotations" -}}
devaiportal.io/expires-at: {{ .Values.expiresAt | quote }}
devaiportal.io/request-id: {{ .Values.requestId | quote }}
{{- end -}}

{{- define "environment.validateImage" -}}
{{- $platform := .Files.Get "files/platform.yaml" | fromYaml -}}
{{- $image := .Values.image -}}
{{- if hasSuffix ":latest" $image -}}
  {{- fail (printf "Image '%s' uses forbidden ':latest' tag" $image) -}}
{{- end -}}
{{- $allowed := $platform.namespaces.allowedRegistries -}}
{{- $valid := false -}}
{{- range $reg := $allowed -}}
  {{- if or (hasPrefix (printf "%s/" $reg) $image) (and (eq $reg "docker.io") (not (contains "/" $image))) -}}
    {{- $valid = true -}}
  {{- end -}}
{{- end -}}
{{- if not $valid -}}
  {{- fail (printf "Image '%s' is not from an allowed registry: %v" $image $allowed) -}}
{{- end -}}
{{- end -}}
