/**
 * Tarjetas de estadísticas del dashboard
 */
import React from 'react';
import { Row, Col, Statistic, Progress } from 'antd';
import {
  FileTextOutlined, CheckCircleOutlined,
  CloseCircleOutlined, ClockCircleOutlined
} from '@ant-design/icons';
import type { DashboardStats } from '../../types';

interface StatsCardsProps {
  stats: DashboardStats;
}

const StatsCards: React.FC<StatsCardsProps> = ({ stats }) => {
  return (
    <Row gutter={[16, 16]}>
      <Col span={6}>
        <div className="content-panel hover-lift" style={{ padding: '20px 24px', borderRadius: 8 }}>
          <Statistic
            title={<span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Total RFPs</span>}
            value={stats.total_rfps}
            prefix={<FileTextOutlined style={{ fontSize: 20, marginRight: 12, color: 'var(--color-info)' }} />}
            valueStyle={{ color: 'var(--text-primary)', fontSize: 24, fontWeight: 600 }}
          />
        </div>
      </Col>
      <Col span={6}>
        <div className="content-panel hover-lift" style={{ padding: '20px 24px', borderRadius: 8 }}>
          <Statistic
            title={<span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>GO</span>}
            value={stats.go_count}
            prefix={<CheckCircleOutlined style={{ fontSize: 20, marginRight: 12, color: 'var(--color-success)' }} />}
            valueStyle={{ color: 'var(--text-primary)', fontSize: 24, fontWeight: 600 }}
          />
        </div>
      </Col>
      <Col span={6}>
        <div className="content-panel hover-lift" style={{ padding: '20px 24px', borderRadius: 8 }}>
          <Statistic
            title={<span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>NO GO</span>}
            value={stats.no_go_count}
            prefix={<CloseCircleOutlined style={{ fontSize: 20, marginRight: 12, color: 'var(--color-error)' }} />}
            valueStyle={{ color: 'var(--text-primary)', fontSize: 24, fontWeight: 600 }}
          />
        </div>
      </Col>
      <Col span={6}>
        <div className="content-panel hover-lift" style={{ padding: '20px 24px', borderRadius: 8 }}>
          <Statistic
            title={<span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Pendientes</span>}
            value={stats.pending_count + stats.analyzing_count}
            prefix={<ClockCircleOutlined style={{ fontSize: 20, marginRight: 12, color: 'var(--color-warning)' }} />}
            valueStyle={{ color: 'var(--text-primary)', fontSize: 24, fontWeight: 600 }}
          />
        </div>
      </Col>

      {/* GO Rate */}
      <Col span={24}>
        <div className="content-panel" style={{ padding: '16px 24px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 24 }}>
          <span style={{ color: 'var(--text-secondary)', fontSize: 13, minWidth: 100 }}>Tasa de GO:</span>
          <Progress
            percent={parseFloat(stats.go_rate.toFixed(1))}
            strokeColor="var(--color-success)"
            trailColor="var(--bg-tertiary)"
            strokeWidth={8}
            style={{ flex: 1, marginBottom: 0 }}
          />
        </div>
      </Col>
    </Row>
  );
};

export default StatsCards;
