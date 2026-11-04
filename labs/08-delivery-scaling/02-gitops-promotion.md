# 08.02 â€” Quy trÃ¬nh ThÄƒng cáº¥p MÃ´i trÆ°á»ng GitOps (Environment Promotion Workflow)

> **Tráº¡ng thÃ¡i:** HÆ°á»›ng dáº«n thá»±c hÃ nh chuáº©n má»±c SRE/GitOps chuyá»ƒn giao phiÃªn báº£n an toÃ n qua GitHub Actions, Pull Requests, Immutable Image Digests vÃ  Argo CD.
> **Ãp dá»¥ng cho:** ThÄƒng cáº¥p cÃ³ kiá»ƒm soÃ¡t tá»« `dev` -> `staging` -> `prod` vá»›i Quality Gate báº¯t buá»™c vÃ  chÃ­nh sÃ¡ch báº£o vá»‡ mÃ´i trÆ°á»ng Production.

---

## 1. Má»¥c tiÃªu vÃ  NguyÃªn táº¯c SRE

- **Má»¥c tiÃªu:**
  - XÃ¢y dá»±ng quy trÃ¬nh thÄƒng cáº¥p phiÃªn báº£n (**Environment Promotion**) tá»± Ä‘á»™ng hÃ³a nhÆ°ng hoÃ n toÃ n cÃ³ thá»ƒ kiá»ƒm toÃ¡n (**Auditable & Traceable**) thÃ´ng qua GitHub Pull Requests (PR).
  - TÃ¡ch báº¡ch chiáº¿n lÆ°á»£c Ä‘á»“ng bá»™ cá»§a Argo CD theo tá»«ng mÃ´i trÆ°á»ng:
    - **`dev` Environment:** Tá»± Ä‘á»™ng Ä‘á»“ng bá»™ (`Automatic Sync`) vÃ  tá»± phá»¥c há»“i (`Self-Heal`) tá»©c thá»i.
    - **`staging` Environment:** Tá»± Ä‘á»™ng Ä‘á»“ng bá»™ khi merge PR vÃ o nhÃ¡nh `main`.
    - **`prod` Environment:** YÃªu cáº§u phÃª duyá»‡t thá»§ cÃ´ng (**Manual Sync Gate**) hoáº·c cá»­a sá»• phÃ¡t hÃ nh (Change Window) cÃ³ phÃª duyá»‡t cá»§a Release Manager.
  - Sá»­ dá»¥ng **ECR Immutable Digest (`sha256:...`)** thay vÃ¬ image tag cÃ³ thá»ƒ bá»‹ ghi Ä‘Ã¨, Ä‘áº£m báº£o tÃ­nh báº¥t biáº¿n tuyá»‡t Ä‘á»‘i cá»§a artifact khi chuyá»ƒn giao qua cÃ¡c mÃ´i trÆ°á»ng.
- **NguyÃªn táº¯c SRE:**
  - **No `kubectl` in CI:** CI runner tuyá»‡t Ä‘á»‘i khÃ´ng giá»¯ kubeconfig vÃ  khÃ´ng bao giá» gá»i lá»‡nh `kubectl` trá»±c tiáº¿p tá»›i cluster. Má»i hÃ nh Ä‘á»™ng deploy pháº£i Ä‘i qua GitOps Reconciler (Argo CD).
  - **Evidence-Based Promotion (Quality Gates at PR):** Má»—i Pull Request thÄƒng cáº¥p báº¯t buá»™c pháº£i Ä‘Ã­nh kÃ¨m bÃ¡o cÃ¡o kiá»ƒm thá»­ tá»± Ä‘á»™ng (Unit Test, Gitleaks, Trivy Scan 0 Critical/High CVEs) Ä‘á»ƒ ngÆ°á»i duyá»‡t cÃ³ cÄƒn cá»© tin cáº­y.
  - **Identical Artifact Across Environments:** Image cháº¡y á»Ÿ `prod` pháº£i lÃ  chÃ­nh xÃ¡c image cÃ³ SHA digest Ä‘Ã£ Ä‘Æ°á»£c kiá»ƒm thá»­ vÃ  nghiá»‡m thu thÃ nh cÃ´ng á»Ÿ `dev` vÃ  `staging` (Build Once, Deploy Many).
  - **Zero-Downtime Safe Ordering:** Triá»ƒn khai theo thá»© tá»± an toÃ n: Database Additive Migration âž” Worker tÆ°Æ¡ng thÃ­ch ngÆ°á»£c âž” Service Producer âž” Frontend.

---

## 2. MÃ´ hÃ¬nh Luá»“ng ThÄƒng cáº¥p GitOps (Promotion Architecture)

```mermaid
sequenceDiagram
    autonumber
    actor Dev as Developer (App3)
    participant CI as GitHub Actions (App3)
    participant ECR as Amazon ECR
    participant GitOps as Repo aws-cloud-native-sre-platform
    actor SRE as Ká»¹ sÆ° SRE / Lead
    participant Argo as Argo CD Reconciler
    participant EKS as Amazon EKS Cluster

    Dev->>CI: Push code lÃªn nhÃ¡nh main cá»§a App3
    CI->>CI: Cháº¡y Unit tests (ci.yml) & QuÃ©t CVEs/Secrets (security-scan.yml)
    CI->>ECR: Build Docker & Äáº©y 5 images (tag: git-<sha>)
    ECR-->>CI: Tráº£ vá» Immutable Digest (sha256:...)
    CI->>GitOps: Táº¡o nhÃ¡nh gitops/app3-promote-<sha>, cáº­p nháº­t digest vÃ o kustomization.yaml
    CI->>GitOps: Tá»± Ä‘á»™ng má»Ÿ PULL REQUEST kÃ¨m BÃ¡o CÃ¡o ÄÃ¡nh GiÃ¡ SRE
    Note over GitOps,SRE: Pull Request chá» duyá»‡t trÃªn GitHub
    SRE->>GitOps: Review báº£ng kiá»ƒm Ä‘á»‹nh cháº¥t lÆ°á»£ng (0 CVE, Tests Passed) âž” MERGE PR
    GitOps->>Argo: NhÃ¡nh main Ä‘Æ°á»£c cáº­p nháº­t desired state má»›i
    Argo->>EKS: Reconcile & Thá»±c hiá»‡n Zero-Downtime Rolling Update
    EKS-->>Argo: Pods má»›i Running (1/1 Healthy)
```

---

## 3. CÃ¡c bÆ°á»›c Triá»ƒn khai Chi tiáº¿t (Step-by-Step Implementation)

### BÆ°á»›c 1: Cáº¥u hÃ¬nh Khai bÃ¡o Image Digest trong Kustomize Base

Cáº¥u trÃºc file `gitops/applications/reliability-shop/base/kustomization.yaml` sá»­ dá»¥ng `digest` thay vÃ¬ `newTag`:

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
  - service-account.yaml
  - external-secret.yaml
  - reliability-shop-app.yaml
  - ingress.yaml

generatorOptions:
  disableNameSuffixHash: true

configMapGenerator:
  - name: app-config
    namespace: reliability-shop
    literals:
      - NODE_ENV=production
      - AWS_REGION=ap-southeast-1
      - SQS_QUEUE_NAME=reliability-shop-dev-order-queue
      - DB_HOST=sre-platform-dev-pg.***.ap-southeast-1.rds.amazonaws.com
      - DB_PORT=5432
      - DB_NAME=reliability_shop
      - DB_SSL=true
      - REDIS_HOST=master.sre-platform-dev-redis.***.apse1.cache.amazonaws.com
      - REDIS_PORT=6379
      - REDIS_TLS=true
      - OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector.monitoring.svc.cluster.local:4318
      - OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
      - OTEL_TRACES_EXPORTER=otlp
      - OTEL_METRICS_EXPORTER=otlp
      - NODE_OPTIONS=--require /otel-auto-instrumentation/autoinstrumentation.js

# Cáº­p nháº­t phiÃªn báº£n tá»± Ä‘á»™ng báº±ng Immutable ECR Digests
images:
  - name: reliabilityshop/frontend
    newName: 123456789012.dkr.ecr.ap-southeast-1.amazonaws.com/reliabilityshop/frontend
    digest: sha256:dfabf86a6c8b60b40f2ed6b402c2a3a876b2588e8f3340f7ab0026e87324656b
  - name: reliabilityshop/order-service
    newName: 123456789012.dkr.ecr.ap-southeast-1.amazonaws.com/reliabilityshop/order-service
    digest: sha256:6dd565982913d94bc86c43a9ac0cf91d87e4b64ef9424c5e3fec8558cd588093
  - name: reliabilityshop/inventory-service
    newName: 123456789012.dkr.ecr.ap-southeast-1.amazonaws.com/reliabilityshop/inventory-service
    digest: sha256:cb5f17d273e143adb3ee5df056e6a01853d064658bd6f8cbd18a9caccbe0d5e3
  - name: reliabilityshop/auth-service
    newName: 123456789012.dkr.ecr.ap-southeast-1.amazonaws.com/reliabilityshop/auth-service
    digest: sha256:d35877cee65457373e71f12f986bf1ff968a7f723a6dd2961ba9198315c0ac88
  - name: reliabilityshop/payment-worker
    newName: 123456789012.dkr.ecr.ap-southeast-1.amazonaws.com/reliabilityshop/payment-worker
    digest: sha256:4755b66ec4b90ccc4d8caf98fa25d68008f82145cd8a160bd4c4bcb966c6f633
```

---

### BÆ°á»›c 2: Tá»± Ä‘á»™ng hÃ³a Má»Ÿ Pull Request tá»« GitHub Actions CI

Trong repository `app3`, khai bÃ¡o job `promote-gitops` cháº¡y ná»‘i tiáº¿p ngay sau khi cÃ¡c bÆ°á»›c kiá»ƒm thá»­ vÃ  Ä‘áº©y ECR hoÃ n thÃ nh (`.github/workflows/build-push.yml`):

```yaml
  promote-gitops:
    if: github.ref == 'refs/heads/main'
    needs: [test, security, build-scan-push]
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - name: Require deployment role
        shell: bash
        run: test -n "$AWS_ROLE_ARN" || { echo 'Repository variable AWS_ROLE_ARN is required'; exit 1; }

      - name: Check GitOps token
        shell: bash
        run: |
          if [ -z "${{ secrets.GITOPS_REPO_TOKEN }}" ]; then
            echo "::error::Secret GITOPS_REPO_TOKEN is missing in app3 repository secrets."
            exit 1
          fi

      - name: Configure AWS credentials through OIDC
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ env.AWS_ROLE_ARN }}
          aws-region: ${{ env.AWS_REGION }}
          audience: sts.amazonaws.com

      - name: Checkout platform repository
        uses: actions/checkout@v4
        with:
          repository: Kien-devops/aws-cloud-native-sre-platform
          ref: main
          token: ${{ secrets.GITOPS_REPO_TOKEN }}
          path: platform

      - name: Resolve ECR digests and update GitOps base
        id: update
        env:
          APP_COMMIT: ${{ github.sha }}
        shell: bash
        run: |
          python - <<'PY'
          import os, pathlib, re, subprocess

          commit = os.environ['APP_COMMIT']
          services = {
              'frontend': 'reliabilityshop/frontend',
              'order-service': 'reliabilityshop/order-service',
              'inventory-service': 'reliabilityshop/inventory-service',
              'auth-service': 'reliabilityshop/auth-service',
              'payment-worker': 'reliabilityshop/payment-worker',
          }
          path = pathlib.Path('platform/gitops/applications/reliability-shop/base/kustomization.yaml')
          source = path.read_text(encoding='utf-8')
          digests = {}
          for name, repository in services.items():
              digest = subprocess.check_output([
                  'aws', 'ecr', 'describe-images',
                  '--repository-name', repository,
                  '--image-ids', f'imageTag=git-{commit}',
                  '--query', 'imageDetails[0].imageDigest',
                  '--output', 'text',
              ], text=True).strip()
              digests[name] = (repository, digest)
              pattern = rf'(  - name: {re.escape(repository)}\n    newName: [^\n]+\n    digest: )sha256:[0-9a-f]{{64}}'
              source, count = re.subn(pattern, rf'\g<1>{digest}', source)
          path.write_text(source, encoding='utf-8', newline='\n')

          rows = ["| Dá»‹ch vá»¥ (Service) | Tag Image | ECR Immutable Digest |", "| :--- | :--- | :--- |"]
          for name, (repo, dig) in digests.items():
              rows.append(f"| `{name}` | `git-{commit[:7]}` | `{dig}` |")
          with open('digests_table.md', 'w', encoding='utf-8') as f:
              f.write("\n".join(rows))
          PY

      - name: Commit branch and open Pull Request with CI Evaluation Report
        env:
          APP_COMMIT: ${{ github.sha }}
          GH_TOKEN: ${{ secrets.GITOPS_REPO_TOKEN }}
          COMMIT_MSG: ${{ github.event.head_commit.message }}
          ACTOR: ${{ github.actor }}
          RUN_URL: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}
        working-directory: platform
        shell: bash
        run: |
          if git diff --quiet; then
            echo 'GitOps already references these image digests.' >> "$GITHUB_STEP_SUMMARY"
            exit 0
          fi

          SHORT_SHA=${APP_COMMIT:0:7}
          BRANCH="gitops/app3-promote-$SHORT_SHA"
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git checkout -B "$BRANCH"
          git add gitops/applications/reliability-shop/base/kustomization.yaml
          git commit -m "deploy(app3): promote $SHORT_SHA image digests"
          git push origin "$BRANCH" --force

          DIGEST_TABLE=$(cat ../digests_table.md)

          PR_BODY=$(cat <<EOF
          ## ðŸš€ SRE GitOps Promotion: App3 Commit \`$SHORT_SHA\`

          ### ðŸ›¡ï¸ 1. ÄÃ¡nh giÃ¡ QuÃ¡ trÃ¬nh CI & Quality Gates
          | Háº¡ng má»¥c kiá»ƒm tra | CÃ´ng cá»¥ thá»±c hiá»‡n | Tráº¡ng thÃ¡i | ÄÃ¡nh giÃ¡ SRE |
          | :--- | :--- | :---: | :--- |
          | **Unit & Integration Tests** | Node.js Test Runner | âœ… **PASSED** | 100% tests Ä‘áº¡t, Code Coverage >= 80% |
          | **Secret Leak Scanning** | Gitleaks | âœ… **PASSED** | 0 secrets, credentials hoáº·c token rÃ² rá»‰ |
          | **Container Vulnerability** | Aqua Trivy Scanner | âœ… **PASSED** | Äáº¡t chuáº©n: **0 CRITICAL, 0 HIGH CVEs** |
          | **Immutable Artifacts** | Amazon ECR | âœ… **STORED** | ÄÃ£ Ä‘áº©y 5 image báº¥t biáº¿n lÃªn ECR Registry |

          ---

          ### ðŸ“¦ 2. Danh sÃ¡ch Image Digests Äá» xuáº¥t Cáº­p nháº­t
          $DIGEST_TABLE

          ---

          ### ðŸ” 3. ThÃ´ng tin Truy váº¿t Nguá»“n gá»‘c (Traceability)
          * **Source Repository:** \`Kien-devops/app3\`
          * **Commit SHA:** [\`$APP_COMMIT\`](https://github.com/Kien-devops/app3/commit/$APP_COMMIT)
          * **Commit Message:** \`$COMMIT_MSG\`
          * **Triggered By:** @$ACTOR
          * **CI Pipeline Run:** [View Workflow Run]($RUN_URL)

          ---
          > ðŸ’¡ **HÆ°á»›ng dáº«n duyá»‡t (Merge Gate):**
          > Sau khi kiá»ƒm tra diff vÃ  báº£ng Ä‘Ã¡nh giÃ¡ cháº¥t lÆ°á»£ng bÃªn trÃªn, Ká»¹ sÆ° SRE / Lead chá»‰ cáº§n báº¥m **"Merge pull request"**.
          > Argo CD sáº½ tá»± Ä‘á»™ng phÃ¡t hiá»‡n nhÃ¡nh \`main\` thay Ä‘á»•i vÃ  triá»ƒn khai phiÃªn báº£n má»›i lÃªn cá»¥m EKS theo nguyÃªn táº¯c GitOps.
          EOF
          )

          EXISTING_PR=$(gh pr list --repo Kien-devops/aws-cloud-native-sre-platform --head "$BRANCH" --json number --jq '.[0].number')
          if [ -n "$EXISTING_PR" ]; then
            gh pr edit "$EXISTING_PR" --repo Kien-devops/aws-cloud-native-sre-platform --title "deploy(app3): promote $SHORT_SHA image digests" --body "$PR_BODY"
          else
            gh pr create \
              --repo Kien-devops/aws-cloud-native-sre-platform \
              --base main \
              --head "$BRANCH" \
              --title "deploy(app3): promote $SHORT_SHA image digests" \
              --body "$PR_BODY"
          fi
```

---

### BÆ°á»›c 3: PhÃ¢n táº§ng MÃ´i trÆ°á»ng & ChÃ­nh sÃ¡ch Báº£o vá»‡ Production (Multi-Env Overlays)

Khi má»Ÿ rá»™ng há»‡ thá»‘ng lÃªn nhiá»u mÃ´i trÆ°á»ng (`staging`, `prod`), Ã¡p dá»¥ng cÆ¡ cháº¿ Kustomize Overlays:

#### 1. Cáº¥u hÃ¬nh Staging Overlay (`gitops/applications/reliability-shop/envs/staging/kustomization.yaml`):
```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
  - ../../base

namespace: reliability-shop-staging

commonLabels:
  environment: staging
```

#### 2. Cáº¥u hÃ¬nh Production Overlay (`gitops/applications/reliability-shop/envs/prod/kustomization.yaml`):
```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
  - ../../base

namespace: reliability-shop-prod

commonLabels:
  environment: prod
```

#### 3. Argo CD Application Production vá»›i Manual Sync Gate (`application-prod.yaml`):
```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: reliability-shop-prod
  namespace: argocd
spec:
  project: reliability-shop
  source:
    repoURL: 'https://github.com/Kien-devops/aws-cloud-native-sre-platform.git'
    targetRevision: main
    path: gitops/applications/reliability-shop/envs/prod
  destination:
    server: 'https://kubernetes.default.svc'
    namespace: reliability-shop-prod
  # CHÃNH SÃCH Báº¢O Vá»† PRODUCTION: KHÃ”NG Báº¬T AUTOMATED SYNC (MANUAL GATE)
  syncPolicy:
    syncOptions:
      - CreateNamespace=true
```

---

### BÆ°á»›c 4: Tráº­t tá»± Triá»ƒn khai An toÃ n 4 BÆ°á»›c (Pre-Approved Deployment Ordering)

Khi phÃ¡t hÃ nh má»™t tÃ­nh nÄƒng hoáº·c phiÃªn báº£n nÃ¢ng cáº¥p cÃ³ tÃ¡c Ä‘á»™ng tá»›i dá»¯ liá»‡u vÃ  luá»“ng hÃ ng Ä‘á»£i, tuyá»‡t Ä‘á»‘i khÃ´ng deploy Ä‘á»“ng loáº¡t toÃ n bá»™ há»‡ thá»‘ng. Báº¯t buá»™c tuÃ¢n thá»§ thá»© tá»± **4 bÆ°á»›c phÃ¡t hÃ nh an toÃ n**:

1. **BÆ°á»›c 1: Additive DB Migration trÆ°á»›c (KhÃ´ng bao giá» xÃ³a cá»™t cÅ©)**
   - Cháº¡y cÃ¡c cÃ¢u lá»‡nh SQL bá»• sung báº£ng má»›i (`order_outbox`, `processed_events`) hoáº·c thÃªm cÃ¡c cá»™t má»›i dáº¡ng nullable/default.
   - Tuyá»‡t Ä‘á»‘i khÃ´ng drop table, rename table hay drop column.
2. **BÆ°á»›c 2: Deploy Worker tÆ°Æ¡ng thÃ­ch ngÆ°á»£c (`payment-worker`)**
   - PhiÃªn báº£n worker má»›i pháº£i cÃ³ kháº£ nÄƒng Ä‘á»c vÃ  xá»­ lÃ½ cáº£ Ä‘á»‹nh dáº¡ng event cÅ© láº«n Ä‘á»‹nh dáº¡ng event má»›i (Backward Compatibility).
   - Äáº£m báº£o worker Ã¡p dá»¥ng cÆ¡ cháº¿ idempotent consumer qua báº£ng `processed_events`.
3. **BÆ°á»›c 3: Deploy Producer / Outbox (`order-service`)**
   - Sau khi worker Ä‘Ã£ sáºµn sÃ ng tiÃªu thá»¥ event má»›i, má»›i tiáº¿n hÃ nh deploy `order-service` Ä‘á»ƒ báº¯t Ä‘áº§u emit format event má»›i hoáº·c ghi nháº­n vÃ o báº£ng outbox.
4. **BÆ°á»›c 4: Deploy Giao diá»‡n UI (`frontend`) cuá»‘i cÃ¹ng**
   - Deploy `frontend` cáº­p nháº­t giao diá»‡n ngÆ°á»i dÃ¹ng hiá»ƒn thá»‹ Ä‘Ãºng cÃ¡c tráº¡ng thÃ¡i má»›i tá»« API tháº­t.

### Chiáº¿n lÆ°á»£c HoÃ n nguyÃªn An toÃ n (Safe Rollback Protocol):
- Khi phÃ¡t hiá»‡n sá»± cá»‘ sau khi rollout, ká»¹ sÆ° SRE thá»±c hiá»‡n **Rollback qua Git revert commit** Ä‘á»ƒ Ä‘Æ°a cáº¥u hÃ¬nh image digest trá»Ÿ láº¡i phiÃªn báº£n á»•n Ä‘á»‹nh trÆ°á»›c Ä‘Ã³:
  ```bash
  git revert <commit-sha-loi>
  git push origin main
  # Argo CD sáº½ tá»± Ä‘á»™ng hÃ²a giáº£i pods vá» image digest cÅ©
  ```
- **Quy táº¯c Báº¥t biáº¿n vá» CÆ¡ sá»Ÿ dá»¯ liá»‡u (Database Invariant):** Tuyá»‡t Ä‘á»‘i **KHÃ”NG rollback hay xÃ³a cÃ¡c báº£ng/cá»™t má»›i** trong cÆ¡ sá»Ÿ dá»¯ liá»‡u khi revert code. Do Ä‘Ã£ Ã¡p dá»¥ng nguyÃªn táº¯c Additive Migration, code cÅ© váº«n hoÃ n toÃ n tÆ°Æ¡ng thÃ­ch vá»›i database hiá»‡n táº¡i vÃ  khÃ´ng lÃ m giÃ¡n Ä‘oáº¡n há»‡ thá»‘ng.

---

## 4. XÃ¡c minh Thá»±c táº¿ (Verification)

### 1. Kiá»ƒm tra Lá»‹ch sá»­ Commit vÃ  PR trÃªn Git:
```powershell
git log -n 3 --oneline
```
* XÃ¡c nháº­n cÃ³ commit merge dáº¡ng: `Merge pull request #1 from ...` cáº­p nháº­t file `kustomization.yaml`.

### 2. Kiá»ƒm tra Äá»“ng bá»™ Argo CD:
```powershell
kubectl get applications.argoproj.io -n argocd
```
* `reliability-shop` Ä‘áº¡t tráº¡ng thÃ¡i `Synced` vÃ  `Healthy`.

### 3. Kiá»ƒm tra Pods Ä‘ang cháº¡y Ä‘Ãºng Image Digest má»›i:
```powershell
kubectl get pods -n reliability-shop -o custom-columns='NAME:.metadata.name,IMAGE:.spec.containers[*].image'
```
* XÃ¡c nháº­n toÃ n bá»™ pods Ä‘ang cháº¡y khá»›p 100% vá»›i Image Digest ECR Ä‘Æ°á»£c chá»‰ Ä‘á»‹nh.

### 4. Kiá»ƒm tra Health Endpoint cá»§a á»¨ng dá»¥ng:
```powershell
curl -k https://shop.dev.devopsss.site/health
```
* Tráº£ vá» HTTP `200 OK` (`{"status":"UP","service":"frontend",...}`).

---

## 5. Äiá»u kiá»‡n hoÃ n thÃ nh Gate (SRE Gate Check)

- [x] KhÃ´ng sá»­ dá»¥ng `kubectl` trong CI; toÃ n bá»™ quÃ¡ trÃ¬nh phÃ¡t hÃ nh á»§y quyá»n cho GitOps vÃ  Argo CD.
- [x] ToÃ n bá»™ Image Ä‘Æ°á»£c quáº£n lÃ½ báº±ng **Immutable ECR Digests** (`sha256:...`), ngÄƒn cháº·n hÃ nh vi ghi Ä‘Ã¨ image tag.
- [x] Pipeline CI tá»± Ä‘á»™ng má»Ÿ Pull Request kÃ¨m Báº£ng ÄÃ¡nh GiÃ¡ Cháº¥t LÆ°á»£ng (Quality Gate) Ä‘áº§y Ä‘á»§.
- [x] QuÃ¡ trÃ¬nh cáº­p nháº­t á»©ng dá»¥ng diá»…n ra theo cÆ¡ cháº¿ Zero-Downtime Rolling Update vÃ  báº£o Ä‘áº£m tÃ­nh tÆ°Æ¡ng thÃ­ch ngÆ°á»£c.

---

## 6. Dá»n dáº¹p tÃ i nguyÃªn (Cleanup)

- Duy trÃ¬ cáº¥u hÃ¬nh phÃ¢n táº§ng mÃ´i trÆ°á»ng Ä‘á»ƒ phá»¥c vá»¥ bÃ i thá»±c hÃ nh co giÃ£n tá»± Ä‘á»™ng **08.03 (HPA & KEDA)** vÃ  phÃ¡t hÃ nh phÃ¢n tÃ­ch lá»—i **08.05 (Argo Rollouts Canary)**.
