<template>
  <div class="page" v-if="rec">
    <!-- 头部 -->
    <div class="flex-between mb16">
      <div class="flex">
        <el-button link @click="$router.back()">← 返回</el-button>
        <span class="page-title" style="margin: 0">{{ rec.recordNo }}</span>
        <el-tag :type="RECORD_STATUS[rec.status].type">{{ RECORD_STATUS[rec.status].label }}</el-tag>
        <el-tag v-if="rec.totalSessions > 1" effect="plain">疗程 {{ rec.sessionNo }}/{{ rec.totalSessions }} 次</el-tag>
      </div>
      <div class="flex">
        <el-button v-if="canCancel" type="danger" plain @click="doCancel">取消预约</el-button>
        <el-button v-if="auth.role === 'ADMIN' && rec.status === 'PENDING_DISPATCH'" type="primary" @click="dispatchDialog = true">
          派单
        </el-button>
      </div>
    </div>

    <!-- 流程进度 -->
    <el-card class="section-card">
      <el-steps :active="stepActive" align-center finish-status="success">
        <el-step title="预约提交" :description="fmtTime(rec.createdAt)" />
        <el-step title="风险评估" :description="rec.riskAssessment ? RISK_LEVELS[rec.riskAssessment.riskLevel].label : ''" />
        <el-step title="派单接单" :description="acceptedDispatch ? `${acceptedDispatch.therapist?.name} 已接单` : '待派单/接单'" />
        <el-step title="上门签到" :description="currentVisit?.checkinAt || rec.visits?.length ? fmtTime(rec.visits[0]?.checkinAt) : ''" />
        <el-step title="服务完成" :description="completedVisit ? fmtTime(completedVisit.completedAt) : ''" />
        <el-step title="结算" :description="rec.settlement ? SETTLEMENT_STATUS[rec.settlement.status].label : '待生成'" />
      </el-steps>
    </el-card>

    <el-row :gutter="16">
      <el-col :md="12" :xs="24">
        <!-- 预约信息 -->
        <el-card class="section-card">
          <template #header><b>预约信息</b></template>
          <div class="kv">
            <div><span class="k">用户</span>{{ rec.user?.name }}（{{ rec.user?.phone }}）</div>
            <div><span class="k">预约时间</span>{{ fmtTime(rec.appointmentAt) }}</div>
            <div><span class="k">地址</span>{{ rec.address }}</div>
            <div><span class="k">楼层/电梯</span>{{ rec.floor }} 层 · {{ rec.hasElevator ? '有电梯' : '无电梯' }}</div>
            <div><span class="k">可服务时间</span>{{ (rec.availableSlots || []).join('、') || '—' }}</div>
            <div><span class="k">家属陪同</span>{{ rec.familyAccompany ? `有（${rec.familyNotes || '未备注'}）` : '无' }}</div>
            <div><span class="k">疼痛部位</span>{{ (rec.painParts || []).join('、') || '—' }}</div>
            <div><span class="k">初始疼痛评分</span><b style="color: #dc2626">{{ rec.painScoreInitial }}/10</b></div>
            <div v-if="rec.userNote"><span class="k">用户备注</span>{{ rec.userNote }}</div>
            <div v-if="rec.course"><span class="k">所属疗程</span>{{ rec.course.name }}</div>
          </div>
        </el-card>

        <!-- 风险评估 -->
        <el-card class="section-card" v-if="rec.riskAssessment">
          <template #header>
            <div class="flex-between">
              <b>风险评估（{{ auth.role === 'THERAPIST' ? '风险边界' : '服务依据' }}）</b>
              <div class="flex">
                <el-tag :type="RISK_LEVELS[rec.riskAssessment.riskLevel].type">
                  {{ RISK_LEVELS[rec.riskAssessment.riskLevel].label }}
                </el-tag>
                <el-tag v-if="!rec.riskAssessment.homeVisitSuitable" type="danger" effect="dark">不建议上门</el-tag>
              </div>
            </div>
          </template>
          <div class="kv mb16">
            <div><span class="k">手法强度上限</span><b style="color: #dc2626">{{ rec.riskAssessment.maxIntensity }}</b></div>
            <div><span class="k">所需器械</span>{{ (rec.riskAssessment.requiredEquipment || []).join('、') || '无' }}</div>
          </div>
          <div v-for="(f, i) in rec.riskAssessment.riskFlags" :key="i" class="risk-flag" :class="f.level">
            <b>[{{ f.flag }}]</b> {{ f.detail }}
          </div>
          <div v-if="!rec.riskAssessment.riskFlags?.length" class="muted">未发现明显风险点</div>
          <div class="basis-box mt8">{{ rec.riskAssessment.suggestions }}</div>
        </el-card>

        <!-- 项目明细 -->
        <el-card class="section-card">
          <template #header>
            <div class="flex-between">
              <b>服务项目明细</b>
              <el-button v-if="isMyActiveVisit" size="small" type="primary" plain @click="openAddItems">临时加项</el-button>
            </div>
          </template>
          <el-table :data="rec.items" size="small">
            <el-table-column prop="name" label="项目" />
            <el-table-column label="单价" width="100">
              <template #default="{ row }">{{ fmtMoney(row.price) }}</template>
            </el-table-column>
            <el-table-column label="来源" width="110">
              <template #default="{ row }">
                <el-tag v-if="row.addedDuringVisit" type="warning" size="small">服务中加项</el-tag>
                <span v-else class="muted">预约项目</span>
              </template>
            </el-table-column>
          </el-table>
        </el-card>

        <!-- 健康档案（技师/管理员可见） -->
        <el-card class="section-card" v-if="rec.healthProfile && auth.role !== 'USER'">
          <template #header><b>用户健康档案</b></template>
          <div class="kv">
            <div><span class="k">年龄/性别</span>{{ rec.healthProfile.age ?? '—' }} / {{ rec.healthProfile.gender || '—' }}</div>
            <div><span class="k">禁忌标签</span>
              <span style="color: #d97706">{{ (rec.healthProfile.contraindicationTags || []).join('、') || '无' }}</span>
            </div>
            <div><span class="k">既往病史</span>{{ rec.healthProfile.medicalHistory || '—' }}</div>
            <div><span class="k">在服药物</span>{{ rec.healthProfile.medications || '—' }}</div>
            <div><span class="k">影像报告</span>{{ rec.healthProfile.imagingReports || '—' }}</div>
            <div><span class="k">过敏史</span>{{ rec.healthProfile.allergies || '—' }}</div>
          </div>
        </el-card>

        <!-- 派单记录 -->
        <el-card class="section-card" v-if="rec.dispatches?.length">
          <template #header><b>派单记录</b></template>
          <div v-for="d in rec.dispatches" :key="d.id" style="font-size: 13px; line-height: 2">
            <el-tag size="small" :type="{ PENDING: 'warning', ACCEPTED: 'success', REJECTED: 'danger', CANCELLED: 'info' }[d.status]">
              {{ { PENDING: '待响应', ACCEPTED: '已接单', REJECTED: '已拒单', CANCELLED: '已取消' }[d.status] }}
            </el-tag>
            {{ d.therapist?.name }} · 派单 {{ fmtTime(d.assignedAt) }}
            <span v-if="d.rejectReason" class="muted"> · 拒单原因：{{ d.rejectReason }}</span>
            <span v-if="d.note" class="muted"> · 备注：{{ d.note }}</span>
          </div>
        </el-card>
      </el-col>

      <el-col :md="12" :xs="24">
        <!-- 技师服务操作台 -->
        <el-card class="section-card" v-if="auth.role === 'THERAPIST' && (rec.status === 'ACCEPTED' || rec.status === 'IN_SERVICE')">
          <template #header><b>服务操作台</b></template>
          <el-button v-if="rec.status === 'ACCEPTED'" type="primary" @click="doCheckin">到场签到</el-button>
          <template v-if="rec.status === 'IN_SERVICE'">
            <el-form label-width="100px" size="default">
              <el-form-item label="疼痛评分">
                <el-slider v-model="visitForm.painScore" :min="0" :max="10" show-input />
              </el-form-item>
              <el-form-item label="动作受限">
                <el-input v-model="visitForm.movementLimitation" placeholder="如：左膝屈伸受限" />
              </el-form-item>
              <el-form-item label="生命体征">
                <div class="flex wrap">
                  <el-input v-model="visitForm.vitals.bp" placeholder="血压 如120/80" style="width: 130px" />
                  <el-input-number v-model="visitForm.vitals.hr" placeholder="心率" :min="30" :max="220" style="width: 110px" />
                  <el-input-number v-model="visitForm.vitals.temp" placeholder="体温" :min="34" :max="43" :step="0.1" style="width: 110px" />
                  <el-input-number v-model="visitForm.vitals.spo2" placeholder="血氧" :min="70" :max="100" style="width: 110px" />
                </div>
              </el-form-item>
              <el-form-item label="实际项目">
                <el-checkbox-group v-model="actualItemNames">
                  <el-checkbox v-for="i in rec.items" :key="i.id" :value="i.name">{{ i.name }}</el-checkbox>
                </el-checkbox-group>
              </el-form-item>
              <el-form-item label="器械使用">
                <el-select v-model="visitForm.equipmentUsed" multiple filterable allow-create default-first-option style="width: 100%">
                  <el-option v-for="e in rec.riskAssessment?.requiredEquipment || []" :key="e" :value="e" :label="e" />
                </el-select>
              </el-form-item>
              <el-form-item label="手法强度">
                <el-select v-model="visitForm.techniqueIntensity" style="width: 160px">
                  <el-option v-for="i in allowedIntensities" :key="i" :value="i" :label="i" />
                </el-select>
                <span class="muted" style="margin-left: 8px">评估上限：{{ rec.riskAssessment?.maxIntensity }}</span>
              </el-form-item>
              <el-form-item label="用户反馈">
                <el-input v-model="visitForm.userFeedback" placeholder="用户当场反馈" />
              </el-form-item>
              <el-form-item label="技师记录">
                <el-input v-model="visitForm.therapistNote" type="textarea" :rows="2" />
              </el-form-item>
              <el-form-item label="复诊建议">
                <el-input v-model="visitForm.nextVisitSuggestion" placeholder="如：建议 1 周后复评" />
              </el-form-item>
            </el-form>
            <div class="flex" style="justify-content: flex-end">
              <el-button @click="saveVisit">保存记录</el-button>
              <el-button type="primary" @click="doComplete">完成本次服务并生成结算</el-button>
            </div>
          </template>
        </el-card>

        <!-- 上门服务记录 -->
        <el-card class="section-card" v-if="rec.visits?.length">
          <template #header><b>上门服务记录</b></template>
          <div v-for="v in rec.visits" :key="v.id" class="visit-block">
            <div class="flex-between">
              <div class="flex">
                <el-tag size="small" :type="v.status === 'COMPLETED' ? 'success' : 'warning'">
                  {{ v.status === 'COMPLETED' ? '已完成' : '进行中' }}
                </el-tag>
                <b>{{ v.therapist?.name }}</b>
                <span class="muted">签到 {{ fmtTime(v.checkinAt) }}（{{ v.checkinLocation }}）</span>
              </div>
              <span v-if="v.completedAt" class="muted">完成 {{ fmtTime(v.completedAt) }}</span>
            </div>
            <template v-if="v.status === 'COMPLETED' || v.painScore != null">
              <div class="kv mt8">
                <div><span class="k">疼痛评分</span>
                  <b :style="{ color: v.painScore > rec.painScoreInitial ? '#dc2626' : '#16a34a' }">
                    {{ v.painScore }}/10
                  </b>
                  <span class="muted">（预约时 {{ rec.painScoreInitial }}/10）</span>
                </div>
                <div><span class="k">手法强度</span>{{ v.techniqueIntensity || '—' }}</div>
                <div><span class="k">动作受限</span>{{ v.movementLimitation || '—' }}</div>
                <div><span class="k">生命体征</span>
                  <span v-if="v.vitals">
                    血压 {{ v.vitals.bp || '—' }} · 心率 {{ v.vitals.hr ?? '—' }} ·
                    体温 {{ v.vitals.temp ?? '—' }} · 血氧 {{ v.vitals.spo2 ?? '—' }}
                  </span>
                  <span v-else>—</span>
                </div>
                <div><span class="k">实际项目</span>{{ (v.actualItems || []).map((a) => a.name).join('、') || '—' }}</div>
                <div><span class="k">器械使用</span>{{ (v.equipmentUsed || []).join('、') || '—' }}</div>
                <div><span class="k">用户反馈</span>{{ v.userFeedback || '—' }}</div>
                <div><span class="k">技师记录</span>{{ v.therapistNote || '—' }}</div>
                <div v-if="v.nextVisitSuggestion"><span class="k">复诊建议</span>{{ v.nextVisitSuggestion }}</div>
              </div>
              <div v-if="auth.role === 'USER'" class="basis-box mt8">
                本次服务依据：基于预约时风险评估（{{ RISK_LEVELS[rec.riskAssessment?.riskLevel]?.label }}，
                手法强度上限 {{ rec.riskAssessment?.maxIntensity }}）执行上述项目；
                疼痛变化 {{ rec.painScoreInitial }} → {{ v.painScore }}，理疗效果并非每次线性改善，
                平台将结合随访与异常记录评估后续疗程。
              </div>
            </template>
          </div>
        </el-card>

        <!-- 异常事件 -->
        <el-card class="section-card">
          <template #header>
            <div class="flex-between">
              <b>异常事件（{{ rec.exceptions?.length || 0 }}）</b>
              <el-button v-if="auth.role !== 'ADMIN' && canReport" size="small" type="warning" plain @click="exceptionDialog = true">
                上报异常
              </el-button>
            </div>
          </template>
          <el-empty v-if="!rec.exceptions?.length" description="暂无异常" :image-size="60" />
          <div v-for="e in rec.exceptions" :key="e.id" class="exc-line">
            <div class="flex">
              <el-tag size="small" type="warning" effect="plain">{{ EXCEPTION_TYPES[e.type] }}</el-tag>
              <el-tag size="small" :type="EXCEPTION_STATUS[e.status].type">{{ EXCEPTION_STATUS[e.status].label }}</el-tag>
              <span class="muted">{{ fmtTime(e.createdAt) }}</span>
            </div>
            <div style="font-size: 13px; margin-top: 4px">{{ e.description }}</div>
            <div v-if="e.resolution" class="muted" style="font-size: 12px; margin-top: 2px">
              处理：{{ e.resolution }}（{{ fmtTime(e.resolvedAt) }}）
            </div>
          </div>
        </el-card>

        <!-- 结算 -->
        <el-card class="section-card" v-if="rec.settlement">
          <template #header>
            <div class="flex-between">
              <b>结算单</b>
              <el-tag :type="SETTLEMENT_STATUS[rec.settlement.status].type">
                {{ SETTLEMENT_STATUS[rec.settlement.status].label }}
              </el-tag>
            </div>
          </template>
          <div class="kv">
            <div><span class="k">应收总额</span><b style="color: #dc2626">{{ fmtMoney(rec.settlement.totalAmount) }}</b></div>
            <div><span class="k">医保承担</span>{{ fmtMoney(rec.settlement.insuranceAmount) }}</div>
            <div><span class="k">社区补贴</span>{{ fmtMoney(rec.settlement.subsidyAmount) }}</div>
            <div><span class="k">个人自付</span><b>{{ fmtMoney(rec.settlement.selfPayAmount) }}</b></div>
            <div v-if="rec.settlement.channel"><span class="k">结算通道</span>
              {{ { INSURANCE: '医保', SUBSIDY: '社区补贴', SELF: '自费' }[rec.settlement.channel] }}
            </div>
            <div v-if="rec.settlement.paidAt"><span class="k">支付时间</span>{{ fmtTime(rec.settlement.paidAt) }}</div>
            <div v-if="rec.settlement.failureReason"><span class="k">失败原因</span>
              <span style="color: #dc2626">{{ rec.settlement.failureReason }}</span>
            </div>
            <div v-if="rec.settlement.refundAmount"><span class="k">退款</span>
              {{ fmtMoney(rec.settlement.refundAmount) }}（{{ rec.settlement.refundReason }}）
            </div>
          </div>
          <div class="flex mt16" v-if="auth.role === 'USER'">
            <el-button v-if="['PENDING', 'FAILED'].includes(rec.settlement.status)" type="primary" @click="payDialog = true">
              去结算
            </el-button>
            <el-button v-if="rec.settlement.status === 'PAID'" type="danger" plain @click="refundDialog = true">
              申请退款
            </el-button>
          </div>
        </el-card>

        <!-- 随访 -->
        <el-card class="section-card">
          <template #header>
            <div class="flex-between">
              <b>随访记录（{{ rec.followUps?.length || 0 }}）</b>
              <el-button v-if="canFollowUp" size="small" type="primary" plain @click="followUpDialog = true">登记随访</el-button>
            </div>
          </template>
          <el-empty v-if="!rec.followUps?.length" description="暂无随访" :image-size="60" />
          <div v-for="f in rec.followUps" :key="f.id" class="exc-line">
            <div class="flex">
              <el-tag size="small" effect="plain">{{ f.method }}</el-tag>
              <span class="muted">{{ fmtTime(f.createdAt) }}</span>
              <span v-if="f.painScoreAfter != null" class="muted">疼痛 {{ f.painScoreAfter }}/10</span>
              <span v-if="f.satisfaction" class="muted">满意度 {{ f.satisfaction }}/5</span>
            </div>
            <div style="font-size: 13px; margin-top: 4px">{{ f.content }}</div>
            <div v-if="f.nextPlan" class="muted" style="font-size: 12px">后续计划：{{ f.nextPlan }}</div>
          </div>
        </el-card>

        <!-- 转诊建议 -->
        <el-card class="section-card">
          <template #header>
            <div class="flex-between">
              <b>转诊/复诊建议（{{ rec.referrals?.length || 0 }}）</b>
              <el-button v-if="canFollowUp" size="small" type="danger" plain @click="referralDialog = true">登记转诊</el-button>
            </div>
          </template>
          <el-empty v-if="!rec.referrals?.length" description="暂无转诊建议" :image-size="60" />
          <div v-for="r in rec.referrals" :key="r.id" class="exc-line">
            <div class="flex">
              <el-tag size="small" type="danger" effect="plain">{{ r.suggestedDepartment }}</el-tag>
              <span class="muted">{{ fmtTime(r.createdAt) }}</span>
            </div>
            <div style="font-size: 13px; margin-top: 4px">{{ r.reason }}</div>
            <div v-if="r.doctorAdvice" class="muted" style="font-size: 12px">医生建议：{{ r.doctorAdvice }}</div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 派单对话框 -->
    <el-dialog v-model="dispatchDialog" title="派单" width="480px">
      <el-alert type="info" :closable="false" class="mb16"
        title="派单前请对照技师可携带器械与评估所需器械、服务片区" />
      <el-select v-model="dispatchForm.therapistId" placeholder="选择技师" style="width: 100%">
        <el-option v-for="t in therapists" :key="t.id" :value="t.id"
          :label="`${t.name}（${t.profile?.title || '技师'} · ${t.profile?.serviceArea || '片区未填'}）`">
          <div>
            <b>{{ t.name }}</b>
            <span class="muted"> {{ t.profile?.title }} · {{ t.profile?.serviceArea }}</span>
            <div class="muted" style="font-size: 12px">器械：{{ (t.profile?.equipment || []).join('、') || '未登记' }}</div>
          </div>
        </el-option>
      </el-select>
      <el-input v-model="dispatchForm.note" placeholder="派单备注（可选）" class="mt8" />
      <template #footer>
        <el-button @click="dispatchDialog = false">取消</el-button>
        <el-button type="primary" @click="doDispatch">确认派单</el-button>
      </template>
    </el-dialog>

    <!-- 加项对话框 -->
    <el-dialog v-model="addItemsDialog" title="服务中临时加项" width="480px">
      <el-alert type="warning" :closable="false" class="mb16" title="加项将同步登记异常事件并计入结算" />
      <el-checkbox-group v-model="addItemsForm.serviceItemIds">
        <div v-for="i in addableItems" :key="i.id" style="padding: 4px 0">
          <el-checkbox :value="i.id">{{ i.name }} <b style="color: #dc2626">¥{{ i.price }}</b></el-checkbox>
        </div>
      </el-checkbox-group>
      <el-empty v-if="!addableItems.length" description="目录中已无更多可加项目" :image-size="60" />
      <template #footer>
        <el-button @click="addItemsDialog = false">取消</el-button>
        <el-button type="primary" @click="doAddItems">确认加项</el-button>
      </template>
    </el-dialog>

    <!-- 支付对话框 -->
    <el-dialog v-model="payDialog" title="发起结算" width="480px" v-if="rec.settlement">
      <el-descriptions :column="1" border size="small">
        <el-descriptions-item label="应收总额">{{ fmtMoney(rec.settlement.totalAmount) }}</el-descriptions-item>
        <el-descriptions-item label="医保承担">{{ fmtMoney(rec.settlement.insuranceAmount) }}</el-descriptions-item>
        <el-descriptions-item label="社区补贴">{{ fmtMoney(rec.settlement.subsidyAmount) }}</el-descriptions-item>
        <el-descriptions-item label="个人自付"><b style="color: #dc2626">{{ fmtMoney(rec.settlement.selfPayAmount) }}</b></el-descriptions-item>
      </el-descriptions>
      <div class="mt16">
        <div style="margin-bottom: 8px">选择结算通道：</div>
        <el-radio-group v-model="payForm.channel">
          <el-radio value="INSURANCE" :disabled="!rec.settlement.insuranceAmount">医保</el-radio>
          <el-radio value="SUBSIDY" :disabled="!rec.settlement.subsidyAmount">社区补贴</el-radio>
          <el-radio value="SELF">自费</el-radio>
        </el-radio-group>
      </div>
      <el-checkbox v-if="payForm.channel !== 'SELF'" v-model="payForm.simulateFailure" class="mt8">
        模拟通道异常（演示医保/补贴结算失败流程）
      </el-checkbox>
      <template #footer>
        <el-button @click="payDialog = false">取消</el-button>
        <el-button type="primary" @click="doPay">确认支付</el-button>
      </template>
    </el-dialog>

    <!-- 退款对话框 -->
    <el-dialog v-model="refundDialog" title="申请退款" width="480px">
      <el-form label-width="90px">
        <el-form-item label="退款金额">
          <el-input-number v-model="refundForm.amount" :min="0.01" :max="rec.settlement?.totalAmount" />
        </el-form-item>
        <el-form-item label="退款原因">
          <el-input v-model="refundForm.reason" type="textarea" :rows="3" placeholder="请说明退款原因" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="refundDialog = false">取消</el-button>
        <el-button type="danger" @click="doRefund">提交申请</el-button>
      </template>
    </el-dialog>

    <!-- 异常上报对话框 -->
    <el-dialog v-model="exceptionDialog" title="上报异常" width="480px">
      <el-form label-width="90px">
        <el-form-item label="异常类型">
          <el-select v-model="exceptionForm.type" style="width: 100%">
            <el-option v-for="(label, key) in reportableExceptionTypes" :key="key" :value="key" :label="label" />
          </el-select>
        </el-form-item>
        <el-form-item label="详细描述">
          <el-input v-model="exceptionForm.description" type="textarea" :rows="3"
            placeholder="请描述异常情况，如不适表现、器械故障现象、家属意见等" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="exceptionDialog = false">取消</el-button>
        <el-button type="warning" @click="doReportException">提交</el-button>
      </template>
    </el-dialog>

    <!-- 随访对话框 -->
    <el-dialog v-model="followUpDialog" title="登记随访" width="480px">
      <el-form label-width="90px">
        <el-form-item label="随访方式">
          <el-radio-group v-model="followUpForm.method">
            <el-radio value="电话">电话</el-radio>
            <el-radio value="线上">线上</el-radio>
            <el-radio value="上门">上门</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="疼痛评分">
          <el-slider v-model="followUpForm.painScoreAfter" :min="0" :max="10" show-input />
        </el-form-item>
        <el-form-item label="满意度">
          <el-rate v-model="followUpForm.satisfaction" />
        </el-form-item>
        <el-form-item label="随访内容">
          <el-input v-model="followUpForm.content" type="textarea" :rows="3" />
        </el-form-item>
        <el-form-item label="后续计划">
          <el-input v-model="followUpForm.nextPlan" placeholder="如：继续疗程 / 暂停观察 / 建议复诊" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="followUpDialog = false">取消</el-button>
        <el-button type="primary" @click="doFollowUp">提交</el-button>
      </template>
    </el-dialog>

    <!-- 转诊对话框 -->
    <el-dialog v-model="referralDialog" title="登记转诊建议" width="480px">
      <el-form label-width="90px">
        <el-form-item label="建议科室">
          <el-input v-model="referralForm.suggestedDepartment" placeholder="如：骨科 / 妇科盆底门诊" />
        </el-form-item>
        <el-form-item label="转诊原因">
          <el-input v-model="referralForm.reason" type="textarea" :rows="2" />
        </el-form-item>
        <el-form-item label="医生建议">
          <el-input v-model="referralForm.doctorAdvice" type="textarea" :rows="2" placeholder="可选" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="referralDialog = false">取消</el-button>
        <el-button type="danger" @click="doReferral">提交</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  addFollowUp, addItems, addReferral, cancelRecord, checkin, completeVisit,
  dispatchRecord, listServiceItems, listTherapists, paySettlement, recordDetail,
  reportException, requestRefund, updateVisit,
} from '../../api';
import { useAuthStore } from '../../stores/auth';
import {
  EXCEPTION_STATUS, EXCEPTION_TYPES, INTENSITIES, RECORD_STATUS,
  RISK_LEVELS, SETTLEMENT_STATUS, fmtMoney, fmtTime,
} from '../../utils';

const route = useRoute();
const auth = useAuthStore();
const rec = ref(null);
const therapists = ref([]);
const catalog = ref([]);

const id = route.params.id;
const load = async () => {
  rec.value = await recordDetail(id);
  if (rec.value.status === 'IN_SERVICE') initVisitForm();
};

// ---- 计算属性 ----
const acceptedDispatch = computed(() => rec.value?.dispatches?.find((d) => d.status === 'ACCEPTED'));
const currentVisit = computed(() => rec.value?.visits?.find((v) => v.status === 'CHECKED_IN'));
const completedVisit = computed(() => rec.value?.visits?.find((v) => v.status === 'COMPLETED'));
const isMyActiveVisit = computed(
  () => auth.role === 'THERAPIST' && rec.value?.status === 'IN_SERVICE'
    && acceptedDispatch.value?.therapist?.id === auth.user?.id,
);
const canCancel = computed(
  () => (auth.role === 'USER' || auth.role === 'ADMIN')
    && ['PENDING_DISPATCH', 'DISPATCHED', 'ACCEPTED'].includes(rec.value?.status),
);
const canReport = computed(() => !['CANCELLED'].includes(rec.value?.status));
const canFollowUp = computed(
  () => (auth.role === 'ADMIN' || (auth.role === 'THERAPIST' && acceptedDispatch.value?.therapist?.id === auth.user?.id))
    && ['COMPLETED', 'SETTLED'].includes(rec.value?.status),
);
const stepActive = computed(() => {
  const s = rec.value?.status;
  if (s === 'SETTLED' || s === 'CLOSED') return 6;
  if (s === 'COMPLETED') return 5;
  if (s === 'IN_SERVICE') return 4;
  if (s === 'ACCEPTED') return 3;
  if (s === 'DISPATCHED') return 2;
  return rec.value?.riskAssessment ? 2 : 1;
});
const reportableExceptionTypes = computed(() => {
  const { ADD_ITEM, SETTLEMENT_FAILED, REFERRAL_SUGGESTED, ...rest } = EXCEPTION_TYPES;
  return auth.role === 'USER'
    ? { DISCOMFORT: rest.DISCOMFORT, FAMILY_COMPLAINT: rest.FAMILY_COMPLAINT, OTHER: rest.OTHER }
    : rest;
});
const allowedIntensities = computed(() => {
  const max = rec.value?.riskAssessment?.maxIntensity;
  const idx = INTENSITIES.indexOf(max);
  return idx <= 0 ? INTENSITIES.slice(0, 3) : INTENSITIES.slice(0, idx + 1);
});
const addableItems = computed(
  () => catalog.value.filter((c) => !rec.value?.items?.some((i) => i.serviceItemId === c.id)),
);

// ---- 派单 ----
const dispatchDialog = ref(false);
const dispatchForm = reactive({ therapistId: null, note: '' });
const doDispatch = async () => {
  if (!dispatchForm.therapistId) return ElMessage.warning('请选择技师');
  await dispatchRecord(id, dispatchForm);
  dispatchDialog.value = false;
  ElMessage.success('已派单');
  load();
};

// ---- 技师操作 ----
const visitForm = reactive({
  painScore: null,
  movementLimitation: '',
  vitals: { bp: '', hr: null, temp: null, spo2: null },
  equipmentUsed: [],
  techniqueIntensity: '中等',
  userFeedback: '',
  therapistNote: '',
  nextVisitSuggestion: '',
});
const actualItemNames = ref([]);
const initVisitForm = () => {
  const v = currentVisit.value;
  if (!v) return;
  visitForm.painScore = v.painScore;
  visitForm.movementLimitation = v.movementLimitation || '';
  visitForm.vitals = { bp: '', hr: null, temp: null, spo2: null, ...(v.vitals || {}) };
  visitForm.equipmentUsed = v.equipmentUsed || [];
  visitForm.techniqueIntensity = v.techniqueIntensity || '中等';
  visitForm.userFeedback = v.userFeedback || '';
  visitForm.therapistNote = v.therapistNote || '';
  visitForm.nextVisitSuggestion = v.nextVisitSuggestion || '';
  actualItemNames.value = (v.actualItems || []).map((a) => a.name);
  if (!actualItemNames.value.length) actualItemNames.value = rec.value.items.map((i) => i.name);
};
const buildVisitPayload = () => ({
  ...visitForm,
  actualItems: rec.value.items
    .filter((i) => actualItemNames.value.includes(i.name))
    .map((i) => ({ name: i.name, price: Number(i.price) })),
});
const doCheckin = async () => {
  await ElMessageBox.confirm('确认已到达用户地址并签到？', '到场签到', { type: 'info' });
  await checkin(id, { location: rec.value.address });
  ElMessage.success('已签到，开始服务');
  load();
};
const saveVisit = async () => {
  await updateVisit(id, buildVisitPayload());
  ElMessage.success('服务记录已保存');
  load();
};
const doComplete = async () => {
  await saveVisit();
  await ElMessageBox.confirm('确认完成本次服务？完成后将生成结算单', '完成服务', { type: 'warning' });
  await completeVisit(id);
  ElMessage.success('服务完成，结算单已生成');
  load();
};

// ---- 加项 ----
const addItemsDialog = ref(false);
const addItemsForm = reactive({ serviceItemIds: [] });
const openAddItems = async () => {
  if (!catalog.value.length) catalog.value = await listServiceItems();
  addItemsForm.serviceItemIds = [];
  addItemsDialog.value = true;
};
const doAddItems = async () => {
  if (!addItemsForm.serviceItemIds.length) return ElMessage.warning('请选择加项项目');
  await addItems(id, addItemsForm);
  addItemsDialog.value = false;
  ElMessage.success('已加项并登记异常事件');
  load();
};

// ---- 结算 ----
const payDialog = ref(false);
const payForm = reactive({ channel: 'SELF', simulateFailure: false });
const doPay = async () => {
  const res = await paySettlement(id, payForm);
  payDialog.value = false;
  if (res.status === 'FAILED') ElMessage.error(res.failureReason);
  else ElMessage.success('支付成功');
  load();
};
const refundDialog = ref(false);
const refundForm = reactive({ amount: null, reason: '' });
const doRefund = async () => {
  if (!refundForm.reason) return ElMessage.warning('请填写退款原因');
  await requestRefund(id, { ...refundForm, amount: refundForm.amount || undefined });
  refundDialog.value = false;
  ElMessage.success('退款申请已提交，等待平台审核');
  load();
};

// ---- 异常 ----
const exceptionDialog = ref(false);
const exceptionForm = reactive({ type: 'DISCOMFORT', description: '' });
const doReportException = async () => {
  if (!exceptionForm.description) return ElMessage.warning('请填写异常描述');
  await reportException(id, { ...exceptionForm, visitId: currentVisit.value?.id });
  exceptionDialog.value = false;
  ElMessage.success('异常已上报');
  load();
};

// ---- 随访 / 转诊 ----
const followUpDialog = ref(false);
const followUpForm = reactive({ method: '电话', content: '', painScoreAfter: 3, satisfaction: 5, nextPlan: '' });
const doFollowUp = async () => {
  if (!followUpForm.content) return ElMessage.warning('请填写随访内容');
  await addFollowUp(id, followUpForm);
  followUpDialog.value = false;
  ElMessage.success('随访已登记');
  load();
};
const referralDialog = ref(false);
const referralForm = reactive({ reason: '', suggestedDepartment: '', doctorAdvice: '' });
const doReferral = async () => {
  if (!referralForm.reason || !referralForm.suggestedDepartment) return ElMessage.warning('请填写完整');
  await addReferral(id, referralForm);
  referralDialog.value = false;
  ElMessage.success('转诊建议已登记');
  load();
};

// ---- 取消 ----
const doCancel = async () => {
  await ElMessageBox.confirm('确认取消该预约？', '取消预约', { type: 'warning' });
  await cancelRecord(id);
  ElMessage.success('已取消');
  load();
};

onMounted(async () => {
  await load();
  if (auth.role === 'ADMIN') therapists.value = await listTherapists();
});
</script>

<style scoped>
.visit-block { border-bottom: 1px dashed #e5ecea; padding: 10px 0; }
.visit-block:last-child { border-bottom: none; }
.exc-line { border-bottom: 1px dashed #e5ecea; padding: 8px 0; }
.exc-line:last-child { border-bottom: none; }
</style>
