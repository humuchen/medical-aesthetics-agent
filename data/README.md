# 示例数据（可直接用于体验数据整合 / 分析）

本目录用于存放医美经营与运营数据。默认 Agent 会在工作目录中直接读取、清洗、合并这些文件并进行分析。
你可以把真实的业务数据（CSV / Excel / JSON）放到这里，替换示例文件即可。

## 文件说明

- `members.csv` —— 会员/客户档案：客户基础信息、消费累计、来源渠道、活跃状态。
- `orders.csv` —— 成交订单：每笔消费的项目、金额、成本、是否新客、归属咨询师。
- `channels.csv` —— 渠道投放：各获客渠道的花费、线索、到店、成交。

## 字段口径（建议）

| 文件 | 关键字段 | 口径说明 |
|------|----------|----------|
| members.csv | total_spend / visit_count / last_visit_date / source_channel | 金额均为实收；last_visit_date 超过 180 天视为沉睡客户 |
| orders.csv | amount / cost / is_new_customer / project_category | amount 为实收；cost 为项目成本，用于算毛利 |
| channels.csv | spend / leads / arrivals / deals | arrivals 为到店数，deals 为成交数 |

> 这只是最小可用示例。真实接入时，Agent 会提示你还缺哪些字段（如到店率所需的预约数、复购所需的二次消费标记等）。
