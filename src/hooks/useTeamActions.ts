import React, { useCallback, useEffect, useRef } from 'react';
import type { Edge, Node } from '@xyflow/react';
import {
  AgentReplyRecord,
  TeamPlanningMember,
  buildProjectPlanningPrompt,
  buildSplitTaskAssignments,
  formatTeamSynthesisPrompt,
  formatTeammateRelayPrompt,
  getLatestAgentReply,
  getTerminalScrollback,
  markConsoleStarted,
  parseProjectTaskPlan,
  playCanvasSound,
  recordInterAgentMessage,
} from '../services/teamCollabBus';
import type { ConsoleNodeData, OrchestratorNodeData, TeamCollabMode } from '../types';
import {
  DEFAULT_HEIGHT,
  DEFAULT_WIDTH,
  TEAM_GAP_X,
  TEAM_GAP_Y,
  TEAM_PADDING_TOP,
  TEAM_PADDING_X,
  computeTeamGridMetrics,
} from '../lib/canvasLayout';

type SetState<T> = React.Dispatch<React.SetStateAction<T>>;

interface TeamActionsDeps {
  setNodes: SetState<Node[]>;
  setEdges: SetState<Edge[]>;
  setPulsingTeamIds: SetState<Record<string, boolean>>;
}

/**
 * Everything a team can do: start/stop/close/rename/regroup, change its collaboration mode,
 * relay replies between teammates, synthesise the work and broadcast a mission.
 */
export function useTeamActions({ setNodes, setEdges, setPulsingTeamIds }: TeamActionsDeps) {
  const activeWorkflowsRef = useRef<
    Record<
      string,
      {
        teamId: string;
        mode: TeamCollabMode;
        originalBrief: string;
        orderedMemberIds: string[];
        currentStepIndex: number;
        maxSteps: number;
        completedMemberIds?: Set<string>;
        repliesByMemberId?: Map<string, AgentReplyRecord>;
        phase?: 'planning' | 'work';
        members?: TeamPlanningMember[];
        plannedTasks?: Map<string, string>;
        fallbackAssignments?: ReturnType<typeof buildSplitTaskAssignments>;
      }
    >
  >({});

  const handleCloseNode = useCallback(
    async (id: string) => {
      markConsoleStarted(id, false);
      if (window.agentCanvasAPI) {
        await window.agentCanvasAPI.killPty(id);
      }
      setNodes((nds) => nds.filter((n) => n.id !== id));
      setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
    },
    [setNodes, setEdges]
  );

  // Team callbacks
  const handleRenameTeam = useCallback(
    (teamId: string, newLabel: string) => {
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id === teamId) {
            return { ...n, data: { ...n.data, label: newLabel } };
          }
          if (
            n.type === 'orchestratorNode' &&
            (n.data as unknown as OrchestratorNodeData).teamId === teamId
          ) {
            return { ...n, data: { ...n.data, teamLabel: newLabel } };
          }
          return n;
        })
      );
    },
    [setNodes]
  );

  const handleStartTeam = useCallback(
    (teamId: string) => {
      setNodes((nds) =>
        nds.map((n) => {
          if (n.type === 'consoleNode' && n.parentId === teamId) {
            markConsoleStarted(n.id, true);
            return {
              ...n,
              data: {
                ...n.data,
                started: true,
                paused: false,
                restoredFromDisk: false,
                status: 'running',
              },
            };
          }
          return n;
        })
      );
    },
    [setNodes]
  );

  const handleStopTeam = useCallback(
    (teamId: string) => {
      delete activeWorkflowsRef.current[teamId];
      setNodes((nds) =>
        nds.map((n) => {
          if (n.type === 'consoleNode' && n.parentId === teamId) {
            markConsoleStarted(n.id, false);
            if (window.agentCanvasAPI) {
              window.agentCanvasAPI.killPty(n.id);
            }
            return {
              ...n,
              data: {
                ...n.data,
                started: false,
                paused: false,
                status: 'idle',
                pendingPrompt: undefined,
              },
            };
          }
          return n;
        })
      );
    },
    [setNodes]
  );

  const handleCloseTeam = useCallback(
    (teamId: string) => {
      delete activeWorkflowsRef.current[teamId];
      const removedIds = new Set<string>([teamId]);
      setNodes((nds) => {
        for (const n of nds) {
          if (n.type === 'consoleNode' && n.parentId === teamId) {
            removedIds.add(n.id);
            markConsoleStarted(n.id, false);
            if (window.agentCanvasAPI) {
              window.agentCanvasAPI.killPty(n.id);
            }
          } else if (
            n.type === 'orchestratorNode' &&
            (n.data as unknown as OrchestratorNodeData).teamId === teamId
          ) {
            removedIds.add(n.id);
          }
        }
        return nds.filter((n) => !removedIds.has(n.id));
      });
      setEdges((eds) =>
        eds.filter((e) => !removedIds.has(e.source) && !removedIds.has(e.target))
      );
    },
    [setNodes, setEdges]
  );

  const handleAutoGridTeam = useCallback(
    (teamId: string) => {
      setNodes((nds) => {
        const members = nds.filter(
          (n) => n.type === 'consoleNode' && n.parentId === teamId
        );
        if (members.length === 0) return nds;

        const { cols, width, height } = computeTeamGridMetrics(members.length);
        let memberIdx = 0;

        return nds.map((n) => {
          if (n.id === teamId) {
            return {
              ...n,
              width,
              height,
              style: { ...n.style, width, height },
            };
          }
          if (n.type === 'consoleNode' && n.parentId === teamId) {
            const col = memberIdx % cols;
            const row = Math.floor(memberIdx / cols);
            memberIdx++;
            return {
              ...n,
              position: {
                x: TEAM_PADDING_X + col * (DEFAULT_WIDTH + TEAM_GAP_X),
                y: TEAM_PADDING_TOP + row * (DEFAULT_HEIGHT + TEAM_GAP_Y),
              },
              width: DEFAULT_WIDTH,
              height: DEFAULT_HEIGHT,
              style: { ...n.style, width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT },
            };
          }
          return n;
        });
      });
    },
    [setNodes]
  );

  const handleUngroupTeam = useCallback(
    (teamId: string) => {
      delete activeWorkflowsRef.current[teamId];
      const removedIds = new Set<string>([teamId]);
      setNodes((nds) => {
        const teamNode = nds.find((n) => n.id === teamId);
        const teamPos = teamNode?.position || { x: 100, y: 100 };

        return nds
          .filter((n) => {
            if (n.id === teamId) return false;
            if (
              n.type === 'orchestratorNode' &&
              (n.data as unknown as OrchestratorNodeData).teamId === teamId
            ) {
              removedIds.add(n.id);
              return false;
            }
            return true;
          })
          .map((n) => {
            if (n.type === 'consoleNode' && n.parentId === teamId) {
              return {
                ...n,
                parentId: undefined,
                extent: undefined,
                position: {
                  x: teamPos.x + n.position.x,
                  y: teamPos.y + n.position.y,
                },
                data: {
                  ...n.data,
                  teamId: undefined,
                },
              };
            }
            return n;
          });
      });

      setEdges((eds) =>
        eds.filter((e) => !removedIds.has(e.source) && !removedIds.has(e.target))
      );
    },
    [setNodes, setEdges]
  );

  // Trigger cable & team frame pulse animation
  const triggerTeamPulse = useCallback((teamId: string) => {
    setPulsingTeamIds((prev) => ({ ...prev, [teamId]: true }));
    setTimeout(() => {
      setPulsingTeamIds((prev) => ({ ...prev, [teamId]: false }));
    }, 1500);
  }, []);

  // Change collaboration mode on an Orchestrator
  const handleChangeCollabMode = useCallback(
    (teamId: string, mode: TeamCollabMode) => {
      delete activeWorkflowsRef.current[teamId];
      setNodes((nds) =>
        nds.map((node) => {
          if (
            node.type === 'orchestratorNode' &&
            (node.data as unknown as OrchestratorNodeData).teamId === teamId
          ) {
            return {
              ...node,
              data: {
                ...node.data,
                collabMode: mode,
              },
            };
          }
          return node;
        })
      );
    },
    [setNodes]
  );

  // Manual 1-click Relay: pass the latest response of `fromNodeId` (or the most recent active teammate) to the other teammates in `teamId`
  const handleTriggerTeamRelay = useCallback(
    (teamId: string, fromNodeId?: string, customInstruction?: string) => {
      triggerTeamPulse(teamId);
      delete activeWorkflowsRef.current[teamId];

      setNodes((nds) => {
        const teamMembers = nds.filter(
          (n) => n.type === 'consoleNode' && n.parentId === teamId
        );
        if (teamMembers.length < 2) return nds;

        // Pick source member
        let sourceNode = fromNodeId
          ? teamMembers.find((m) => m.id === fromNodeId)
          : undefined;

        if (!sourceNode) {
          // Find member with the most recent recorded reply
          let bestTime = '';
          for (const m of teamMembers) {
            const reply = getLatestAgentReply(m.id);
            if (reply && reply.timestamp >= bestTime) {
              bestTime = reply.timestamp;
              sourceNode = m;
            }
          }
          if (!sourceNode) {
            sourceNode = teamMembers[0];
          }
        }

        const sourceData = sourceNode.data as unknown as ConsoleNodeData;
        const latestReply = getLatestAgentReply(sourceNode.id);
        const scrollbackFallback = getTerminalScrollback(sourceNode.id)
          .replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '')
          .trim()
          .slice(-1600);

        const replyContent =
          latestReply?.text ||
          scrollbackFallback ||
          customInstruction ||
          `Analyse et poursuis le travail initié par ${sourceData.label}.`;

        const orchNode = nds.find(
          (n) =>
            n.type === 'orchestratorNode' &&
            (n.data as unknown as OrchestratorNodeData).teamId === teamId
        );
        const orchData = orchNode?.data as unknown as
          | OrchestratorNodeData
          | undefined;
        const mode: TeamCollabMode = orchData?.collabMode || 'relay';

        const recipients = teamMembers.filter((m) => m.id !== sourceNode!.id);
        for (const target of recipients) {
          const targetData = target.data as unknown as ConsoleNodeData;
          recordInterAgentMessage({
            id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            teamId,
            fromNodeId: sourceNode.id,
            fromLabel: sourceData.label || 'Agent',
            fromCommandType: sourceData.commandType || 'claude',
            toNodeId: target.id,
            toLabel: targetData.label || 'Coéquipier',
            summaryText: replyContent.slice(0, 260),
            timestamp: new Date().toLocaleTimeString(),
          });
        }

        const instructionText =
          customInstruction ||
          (mode === 'debate'
            ? `Challenge la proposition de ${sourceData.label}, identifie les points faibles et propose une version améliorée.`
            : `Analyse la proposition de ton coéquipier ${sourceData.label}, complète-la et poursuis le travail.${
                orchData?.lastBroadcastPrompt
                  ? ` (Mission initiale : ${orchData.lastBroadcastPrompt})`
                  : ''
              }`);

        return nds.map((node) => {
          if (
            node.type === 'consoleNode' &&
            node.parentId === teamId &&
            node.id !== sourceNode!.id
          ) {
            markConsoleStarted(node.id, true);
            const relayPrompt = formatTeammateRelayPrompt(
              sourceData.label || 'Agent 1',
              sourceData.commandType || 'claude',
              replyContent,
              instructionText
            );
            return {
              ...node,
              data: {
                ...node.data,
                started: true,
                paused: false,
                restoredFromDisk: false,
                status: 'running',
                pendingPrompt: relayPrompt,
              },
            };
          }
          return node;
        });
      });
    },
    [setNodes, triggerTeamPulse]
  );

  // Assemble / Synthesize Team Work: collects replies/scrollback from all team members and prompts Agent #1 (Lead) to synthesize everything into the final cohesive solution
  const handleSynthesizeTeamWork = useCallback(
    (teamId: string) => {
      triggerTeamPulse(teamId);
      delete activeWorkflowsRef.current[teamId];

      setNodes((nds) => {
        const teamMembers = nds.filter(
          (n) => n.type === 'consoleNode' && n.parentId === teamId
        );
        if (teamMembers.length < 2) return nds;

        const orchNode = nds.find(
          (n) =>
            n.type === 'orchestratorNode' &&
            (n.data as unknown as OrchestratorNodeData).teamId === teamId
        );
        const orchData = orchNode?.data as unknown as
          | OrchestratorNodeData
          | undefined;
        const originalBrief =
          orchData?.lastBroadcastPrompt || 'Mission d’équipe';

        const parts: { label: string; commandType: string; text: string }[] =
          [];
        for (const m of teamMembers) {
          const mData = m.data as unknown as ConsoleNodeData;
          const latest = getLatestAgentReply(m.id);
          const scrollback = getTerminalScrollback(m.id)
            .replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '')
            .trim()
            .slice(-1600);
          const text =
            latest?.text || scrollback || 'Travail en cours...';
          parts.push({
            label: mData.label || 'Agent',
            commandType: mData.commandType || 'claude',
            text,
          });
        }

        const synthesisPrompt = formatTeamSynthesisPrompt(
          originalBrief,
          parts
        );

        // Send synthesis to the lead agent (first member)
        const leadMember = teamMembers[0];
        const leadData = leadMember.data as unknown as ConsoleNodeData;

        recordInterAgentMessage({
          id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          teamId,
          fromNodeId: orchNode?.id || 'orchestrator',
          fromLabel: orchData?.label || 'Orchestrateur',
          fromCommandType: 'orchestrator',
          toNodeId: leadMember.id,
          toLabel: leadData.label || 'Agent 1 (Lead)',
          summaryText: `🧩 Synthèse & assemblage de toutes les parties pour : "${originalBrief.slice(
            0,
            120
          )}"`,
          timestamp: new Date().toLocaleTimeString(),
        });

        return nds.map((n) => {
          if (n.id === leadMember.id) {
            markConsoleStarted(n.id, true);
            return {
              ...n,
              data: {
                ...n.data,
                started: true,
                paused: false,
                restoredFromDisk: false,
                status: 'running',
                pendingPrompt: synthesisPrompt,
              },
            };
          }
          return n;
        });
      });
    },
    [setNodes, triggerTeamPulse]
  );

  // Listen for automatic inter-AI relay/debate steps AND manual "Relayer" button clicks from ConsoleNode headers
  useEffect(() => {
    const onReplyRecorded = (event: Event) => {
      const custom = event as CustomEvent<AgentReplyRecord>;
      const record = custom.detail;
      if (!record || !record.teamId) return;

      const workflow = activeWorkflowsRef.current[record.teamId];
      if (!workflow) return;

      if (workflow.mode === 'split' && workflow.phase === 'planning') {
        const leadId = workflow.orderedMemberIds[0];
        if (record.nodeId !== leadId || !workflow.members?.length) return;

        const heuristicAssignments =
          workflow.fallbackAssignments ||
          buildSplitTaskAssignments(workflow.originalBrief, workflow.members);
        const fallbackTaskById = new Map(
          heuristicAssignments.map((assignment) => [
            assignment.nodeId,
            assignment.subTaskDescription,
          ])
        );
        const plannedTasks =
          parseProjectTaskPlan(record.text, workflow.members) || new Map<string, string>();
        for (const member of workflow.members) {
          if (!plannedTasks.has(member.id)) {
            plannedTasks.set(
              member.id,
              fallbackTaskById.get(member.id) ||
                `Contribue à la mission et vérifie le résultat de l'équipe : ${workflow.originalBrief}`
            );
          }
        }

        workflow.phase = 'work';
        workflow.plannedTasks = plannedTasks;
        workflow.completedMemberIds = new Set<string>();
        workflow.repliesByMemberId = new Map<string, AgentReplyRecord>();

        const sharedPlan = workflow.members
          .map(
            (member, index) =>
              `${index + 1}. ${member.label} (${member.commandType}) : ${plannedTasks.get(member.id)}`
          )
          .join('\n');
        const timestamp = new Date().toLocaleTimeString();
        const promptByMemberId = new Map(
          workflow.members.map((member) => [
            member.id,
            `[MISSION D'ÉQUIPE · TÂCHE VALIDÉE PAR LE CHEF DE PROJET]\nMission initiale : "${workflow.originalBrief}"\n\nPlan partagé :\n${sharedPlan}\n\nTa tâche précise : ${plannedTasks.get(member.id)}\n\nLivre un résultat concret, indique les décisions prises, les dépendances utilisées et tout blocage. Ne rédige pas la réponse finale à l'utilisateur : le chef de projet assemblera les contributions de toute l'équipe.`,
          ])
        );

        for (const member of workflow.members) {
          recordInterAgentMessage({
            id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            teamId: record.teamId,
            fromNodeId: leadId,
            fromLabel: record.label,
            fromCommandType: record.commandType,
            toNodeId: member.id,
            toLabel: member.label,
            summaryText: `📋 Tâche attribuée par le chef de projet : ${plannedTasks.get(member.id)?.slice(0, 200)}`,
            timestamp,
          });
        }

        setNodes((nds) =>
          nds.map((node) => {
            const taskPrompt = promptByMemberId.get(node.id);
            if (node.type !== 'consoleNode' || !taskPrompt) return node;
            markConsoleStarted(node.id, true);
            return {
              ...node,
              data: {
                ...node.data,
                started: true,
                paused: false,
                restoredFromDisk: false,
                status: 'running',
                pendingPrompt: taskPrompt,
              },
            };
          })
        );
        return;
      }

      if (workflow.mode === 'split') {
        if (!workflow.orderedMemberIds.includes(record.nodeId)) return;
        workflow.completedMemberIds ||= new Set<string>();
        workflow.repliesByMemberId ||= new Map<string, AgentReplyRecord>();
        if (workflow.completedMemberIds.has(record.nodeId)) return;

        workflow.completedMemberIds.add(record.nodeId);
        workflow.repliesByMemberId.set(record.nodeId, record);
        if (
          workflow.completedMemberIds.size < workflow.orderedMemberIds.length
        ) {
          return;
        }

        delete activeWorkflowsRef.current[record.teamId];
        const parts = workflow.orderedMemberIds
          .map((memberId) => workflow.repliesByMemberId?.get(memberId))
          .filter((reply): reply is AgentReplyRecord => Boolean(reply))
          .map((reply) => ({
            label: reply.label,
            commandType: reply.commandType,
            text: reply.text,
          }));
        if (parts.length === 0) return;

        const synthesisPrompt = formatTeamSynthesisPrompt(
          workflow.originalBrief,
          parts
        );
        const leadId = workflow.orderedMemberIds[0];
        recordInterAgentMessage({
          id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          teamId: record.teamId,
          fromNodeId: 'orchestrator',
          fromLabel: 'Orchestrateur',
          fromCommandType: 'orchestrator',
          toNodeId: leadId,
          toLabel: parts[0].label,
          summaryText: `🧩 Toutes les parties sont terminées. Assemblage final de : "${workflow.originalBrief.slice(0, 120)}"`,
          timestamp: new Date().toLocaleTimeString(),
        });
        playCanvasSound('complete');
        triggerTeamPulse(record.teamId);
        setNodes((nds) =>
          nds.map((node) => {
            if (node.id !== leadId) return node;
            markConsoleStarted(node.id, true);
            return {
              ...node,
              data: {
                ...node.data,
                started: true,
                paused: false,
                restoredFromDisk: false,
                status: 'running',
                pendingPrompt: synthesisPrompt,
              },
            };
          })
        );
        return;
      }

      const expectedSenderId =
        workflow.orderedMemberIds[
          workflow.currentStepIndex % workflow.orderedMemberIds.length
        ];
      if (record.nodeId !== expectedSenderId) return;

      if (workflow.currentStepIndex >= workflow.maxSteps) {
        delete activeWorkflowsRef.current[record.teamId];
        return;
      }

      workflow.currentStepIndex += 1;
      const nextNodeId =
        workflow.orderedMemberIds[
          workflow.currentStepIndex % workflow.orderedMemberIds.length
        ];
      const isFinalStep = workflow.currentStepIndex >= workflow.maxSteps;
      if (isFinalStep) {
        delete activeWorkflowsRef.current[record.teamId];
        playCanvasSound('complete');
      } else {
        playCanvasSound('relay');
      }

      triggerTeamPulse(record.teamId);

      setNodes((nds) => {
        const nextNode = nds.find((n) => n.id === nextNodeId);
        if (!nextNode) return nds;
        const nextData = nextNode.data as unknown as ConsoleNodeData;

        recordInterAgentMessage({
          id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          teamId: record.teamId!,
          fromNodeId: record.nodeId,
          fromLabel: record.label,
          fromCommandType: record.commandType,
          toNodeId: nextNodeId,
          toLabel: nextData.label || 'Coéquipier',
          summaryText: record.text.slice(0, 260),
          timestamp: new Date().toLocaleTimeString(),
        });

        const stepInstruction =
          workflow.mode === 'debate'
            ? `Débat IA : examine la réponse de ${record.label}, challenge ou enrichis sa proposition pour la mission "${workflow.originalBrief}".`
            : workflow.mode === 'gate'
            ? `🛡️ Revue de Sécurité & Validation de Code : analyse critique, vérifie les failles, régressions et autorise/rejette la mise en prod pour la mission "${workflow.originalBrief}".`
            : `Relais IA : prends le relais de ${record.label} et réalise ta partie pour la mission "${workflow.originalBrief}".`;

        const relayPrompt = formatTeammateRelayPrompt(
          record.label,
          record.commandType,
          record.text,
          stepInstruction
        );

        return nds.map((n) => {
          if (n.id === nextNodeId) {
            markConsoleStarted(n.id, true);
            return {
              ...n,
              data: {
                ...n.data,
                started: true,
                paused: false,
                restoredFromDisk: false,
                status: 'running',
                pendingPrompt: relayPrompt,
              },
            };
          }
          return n;
        });
      });
    };

    const onManualRelayFromNode = (event: Event) => {
      const custom = event as CustomEvent<{ teamId: string; fromNodeId: string }>;
      if (!custom.detail?.teamId) return;
      handleTriggerTeamRelay(custom.detail.teamId, custom.detail.fromNodeId);
    };

    window.addEventListener(
      'agent-canvas-agent-reply-recorded',
      onReplyRecorded as EventListener
    );
    window.addEventListener(
      'agent-canvas-relay-from-node',
      onManualRelayFromNode as EventListener
    );
    return () => {
      window.removeEventListener(
        'agent-canvas-agent-reply-recorded',
        onReplyRecorded as EventListener
      );
      window.removeEventListener(
        'agent-canvas-relay-from-node',
        onManualRelayFromNode as EventListener
      );
    };
  }, [handleTriggerTeamRelay, setNodes, triggerTeamPulse]);

  // Broadcast prompt from Orchestrator to consoles in the linked Team (supports 'relay', 'debate', and 'parallel' modes)
  const handleBroadcastToTeam = useCallback(
    (
      teamId: string,
      prompt: string,
      autoStartIdle: boolean,
      explicitMode?: TeamCollabMode
    ) => {
      const timestamp = new Date().toLocaleTimeString();
      triggerTeamPulse(teamId);
      playCanvasSound('success');

      setNodes((nds) => {
        const orchNode = nds.find(
          (n) =>
            n.type === 'orchestratorNode' &&
            (n.data as unknown as OrchestratorNodeData).teamId === teamId
        );
        const orchData = orchNode?.data as unknown as
          | OrchestratorNodeData
          | undefined;
        const mode: TeamCollabMode =
          explicitMode || orchData?.collabMode || 'split';

        const teamConsoles = nds.filter(
          (n) => n.type === 'consoleNode' && n.parentId === teamId
        );
        const targetMembers = autoStartIdle
          ? teamConsoles
          : teamConsoles.filter(
              (n) => Boolean((n.data as unknown as ConsoleNodeData).started)
            );

        // Split mode: the first agent plans as project lead, then the team works in parallel.
        if (mode === 'split' && targetMembers.length >= 2) {
          delete activeWorkflowsRef.current[teamId];
          const planningMembers: TeamPlanningMember[] = targetMembers.map((member) => {
            const data = member.data as unknown as ConsoleNodeData;
            return {
              id: member.id,
              label: data.label || 'Agent',
              commandType: data.commandType || 'claude',
            };
          });
          const fallbackAssignments = buildSplitTaskAssignments(prompt, planningMembers);
          const leadId = planningMembers[0].id;
          activeWorkflowsRef.current[teamId] = {
            teamId,
            mode: 'split',
            originalBrief: prompt,
            orderedMemberIds: planningMembers.map((member) => member.id),
            currentStepIndex: 0,
            maxSteps: 0,
            phase: 'planning',
            members: planningMembers,
            fallbackAssignments,
          };

          recordInterAgentMessage({
            id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            teamId,
            fromNodeId: orchNode?.id || 'orchestrator',
            fromLabel: orchData?.label || 'Orchestrateur',
            fromCommandType: 'orchestrator',
            toNodeId: leadId,
            toLabel: planningMembers[0].label,
            summaryText: `🧭 Le chef de projet analyse la mission et prépare les tâches pour ${planningMembers.length} agents.`,
            timestamp,
          });
          const planningPrompt = buildProjectPlanningPrompt(prompt, planningMembers);

          return nds.map((node) => {
            if (
              node.type === 'orchestratorNode' &&
              (node.data as unknown as OrchestratorNodeData).teamId === teamId
            ) {
              return {
                ...node,
                data: {
                  ...node.data,
                  collabMode: mode,
                  lastBroadcastPrompt: prompt,
                  lastBroadcastAt: timestamp,
                },
              };
            }

            if (node.type === 'consoleNode' && node.id === leadId) {
              markConsoleStarted(node.id, true);
              return {
                ...node,
                data: {
                  ...node.data,
                  started: true,
                  paused: false,
                  restoredFromDisk: false,
                  status: 'running',
                  pendingPrompt: planningPrompt,
                },
              };
            }

            return node;
          });
        }

        // Configure automatic inter-AI workflow for 'relay', 'debate', or 'gate' when 2+ members are in the team
        if (
          (mode === 'relay' || mode === 'debate' || mode === 'gate') &&
          targetMembers.length >= 2
        ) {
          let orderedIds = targetMembers.map((m) => m.id);
          if (mode === 'gate') {
            // Ensure security/audit specialist is the final gatekeeper
            const isAuditor = (m: Node) => {
              const cd = m.data as unknown as ConsoleNodeData;
              const cmd = (cd.commandType || '').toLowerCase();
              const label = (cd.label || '').toLowerCase();
              return (
                cmd === 'deepseek' ||
                cmd === 'gemini' ||
                label.includes('audit') ||
                label.includes('sécurité') ||
                label.includes('security') ||
                label.includes('review') ||
                label.includes('validateur')
              );
            };
            const auditors = targetMembers.filter(isAuditor);
            const workers = targetMembers.filter((m) => !isAuditor(m));
            if (auditors.length > 0 && workers.length > 0) {
              orderedIds = [...workers.map((m) => m.id), ...auditors.map((m) => m.id)];
            }
          }

          const maxSteps =
            mode === 'relay' || mode === 'gate'
              ? orderedIds.length - 1
              : Math.max(2, orderedIds.length);

          activeWorkflowsRef.current[teamId] = {
            teamId,
            mode,
            originalBrief: prompt,
            orderedMemberIds: orderedIds,
            currentStepIndex: 0,
            maxSteps,
          };

          const firstMemberId = orderedIds[0];
          const firstNode = targetMembers.find((m) => m.id === firstMemberId);
          const firstData = (firstNode?.data || targetMembers[0].data) as unknown as ConsoleNodeData;
          const secondMemberId = orderedIds[1];
          const secondNode = targetMembers.find((m) => m.id === secondMemberId);
          const secondData = (secondNode?.data || targetMembers[1].data) as unknown as ConsoleNodeData;

          const modeBadge =
            mode === 'relay'
              ? 'Relais IA'
              : mode === 'gate'
              ? 'Gate & Revue Sécurité'
              : 'Débat IA';

          recordInterAgentMessage({
            id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            teamId,
            fromNodeId: orchNode?.id || 'orchestrator',
            fromLabel: orchData?.label || 'Orchestrateur',
            fromCommandType: 'orchestrator',
            toNodeId: firstMemberId,
            toLabel: firstData.label || 'Agent 1',
            summaryText: `Mission (${modeBadge}) : ${prompt.slice(0, 180)}`,
            timestamp,
          });

          const firstAgentPrompt =
            mode === 'relay'
              ? `[MISSION D'ÉQUIPE · RELAIS IA (Étape 1/${orderedIds.length}, ta réponse sera transmise automatiquement à ${secondData.label})] ${prompt}`
              : mode === 'gate'
              ? `[MISSION D'ÉQUIPE · CODE & GATE DE SÉCURITÉ (Étape 1/${orderedIds.length}, ta proposition sera auditée et validée par ${secondData.label})] ${prompt}`
              : `[MISSION D'ÉQUIPE · DÉBAT IA (Tour 1, propose ton approche à ${secondData.label} pour qu'il la challenge)] ${prompt}`;

          return nds.map((node) => {
            if (
              node.type === 'orchestratorNode' &&
              (node.data as unknown as OrchestratorNodeData).teamId === teamId
            ) {
              return {
                ...node,
                data: {
                  ...node.data,
                  collabMode: mode,
                  lastBroadcastPrompt: prompt,
                  lastBroadcastAt: timestamp,
                },
              };
            }

            if (node.type === 'consoleNode' && node.parentId === teamId) {
              const cData = node.data as unknown as ConsoleNodeData;
              const isFirst = node.id === firstMemberId;
              if (cData.started || autoStartIdle) {
                markConsoleStarted(node.id, true);
                return {
                  ...node,
                  data: {
                    ...node.data,
                    started: true,
                    paused: false,
                    restoredFromDisk: false,
                    status: 'running',
                    // Only the first AI receives the initial prompt; teammates stay open and ready to receive the automatic relay!
                    pendingPrompt: isFirst ? firstAgentPrompt : cData.pendingPrompt,
                  },
                };
              }
            }

            return node;
          });
        }

        // Parallel mode (or single-agent team): send prompt simultaneously to all members
        delete activeWorkflowsRef.current[teamId];

        return nds.map((node) => {
          if (
            node.type === 'orchestratorNode' &&
            (node.data as unknown as OrchestratorNodeData).teamId === teamId
          ) {
            return {
              ...node,
              data: {
                ...node.data,
                collabMode: mode,
                lastBroadcastPrompt: prompt,
                lastBroadcastAt: timestamp,
              },
            };
          }

          if (node.type === 'consoleNode' && node.parentId === teamId) {
            const cData = node.data as unknown as ConsoleNodeData;
            if (cData.started) {
              markConsoleStarted(node.id, true);
              return {
                ...node,
                data: {
                  ...node.data,
                  pendingPrompt: prompt,
                },
              };
            } else if (autoStartIdle) {
              markConsoleStarted(node.id, true);
              return {
                ...node,
                data: {
                  ...node.data,
                  started: true,
                  paused: false,
                  restoredFromDisk: false,
                  status: 'running',
                  pendingPrompt: prompt,
                },
              };
            }
          }

          return node;
        });
      });
    },
    [setNodes, triggerTeamPulse]
  );


  return {
    activeWorkflowsRef,
    handleCloseNode,
    handleRenameTeam,
    handleStartTeam,
    handleStopTeam,
    handleCloseTeam,
    handleAutoGridTeam,
    handleUngroupTeam,
    triggerTeamPulse,
    handleChangeCollabMode,
    handleTriggerTeamRelay,
    handleSynthesizeTeamWork,
    handleBroadcastToTeam,
  };
}
