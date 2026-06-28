import { Injectable, signal, Renderer2, RendererFactory2 } from '@angular/core';
import { Project } from './project.interface';

export type DropPosition = 'before' | 'after' | 'inside';

@Injectable({ providedIn: 'root' })
export class DragDropService {
    readonly selectedIds = signal<Set<string>>(new Set());
    readonly isDragging = signal(false);

    private dragIds: string[] = [];
    private ghostElement: HTMLElement | null = null;
    private userSelectStyle: HTMLStyleElement | null = null;

    moveCallback!: (ids: string[], targetParentId: string, relativeToId?: string, position?: DropPosition) => void;
    getChildrenMap!: () => Record<string, Project[]>;

    private startMouseX = 0;
    private startMouseY = 0;
    private currentMouseX = 0;
    private currentMouseY = 0;
    private mouseMoved = false;
    private potentialDrag = false;

    private currentTargetElement: HTMLElement | null = null;
    private currentDropPosition: DropPosition | null = null;

    private onToggleExpandCallback: (() => void) | null = null;
    private renderer: Renderer2;
    private removeGlobalListeners: (() => void)[] = [];

    constructor(rendererFactory: RendererFactory2) {
        this.renderer = rendererFactory.createRenderer(null, null);
    }

    onHeaderMouseDown(event: MouseEvent, projectId: string, toggleExpandFn: () => void): void {
        if (event.button !== 0) return;

        const ctrl = event.ctrlKey || event.metaKey;

        // Если нажат Ctrl — отменяем коллбек сворачивания/разворачивания, панель не среагирует
        this.onToggleExpandCallback = ctrl ? null : toggleExpandFn;

        if (ctrl) {
            this.toggleSelection(projectId);
        } else {
            // Обычный клик без Ctrl: если элемент уже в выделении, не сбрасываем сразу (чтобы можно было начать тянуть группу)
            if (!this.selectedIds().has(projectId)) {
                this.selectedIds.set(new Set([projectId]));
            }
        }

        this.potentialDrag = true;
        this.startMouseX = event.clientX;
        this.startMouseY = event.clientY;
        this.mouseMoved = false;

        this.clearGlobalListeners();
        this.removeGlobalListeners = [
            this.renderer.listen('document', 'mousemove', (e: MouseEvent) => this.onMouseMove(e)),
            this.renderer.listen('document', 'mouseup', (e: MouseEvent) => this.onMouseUp(e)),
        ];
    }

    private toggleSelection(projectId: string) {
        const map = this.getChildrenMap();
        // Ищем родителя для текущего кликнутого элемента
        const currentParentId = Object.keys(map).find(pid => map[pid].some(p => p.id === projectId));
        if (!currentParentId) return;

        this.selectedIds.update(set => {
            const newSet = new Set(set);

            if (newSet.has(projectId)) {
                newSet.delete(projectId);
                return newSet;
            }

            // Если в сете уже есть элементы, проверяем, совпадают ли у них родители
            if (newSet.size > 0) {
                const firstSelectedId = Array.from(newSet)[0];
                const existingParentId = Object.keys(map).find(pid => map[pid].some(p => p.id === firstSelectedId));

                // Если родители разные — блокируем добавление, возвращаем стейт без изменений
                if (currentParentId !== existingParentId) {
                    return set;
                }
            }

            newSet.add(projectId);
            return newSet;
        });
    }

    private onMouseMove(event: MouseEvent): void {
        this.currentMouseX = event.clientX;
        this.currentMouseY = event.clientY;

        if (!this.potentialDrag) return;

        const dx = event.clientX - this.startMouseX;
        const dy = event.clientY - this.startMouseY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (!this.mouseMoved && distance > 5) {
            this.mouseMoved = true;
            const selection = this.selectedIds();

            if (selection.size > 0) {
                this.startDrag(Array.from(selection));
            } else {
                this.stopPotentialDrag();
            }
        }

        if (this.isDragging()) {
            event.preventDefault();
            this.updateGhostPosition();
            this.calculateDropTarget(event);
        }
    }

    private startDrag(ids: string[]) {
        this.dragIds = [...ids];

        ids.forEach(id => {
            const el = document.querySelector(`[data-project-id="${id}"]`) as HTMLElement;
            if (el) this.renderer.setStyle(el, 'opacity', '0.4');
        });

        this.ghostElement = this.renderer.createElement('div');
        this.renderer.setStyle(this.ghostElement, 'position', 'fixed');
        this.renderer.setStyle(this.ghostElement, 'z-index', '9999');
        this.renderer.setStyle(this.ghostElement, 'pointer-events', 'none');
        this.renderer.setStyle(this.ghostElement, 'background', '#1565c0');
        this.renderer.setStyle(this.ghostElement, 'color', 'white');
        this.renderer.setStyle(this.ghostElement, 'padding', '8px 14px');
        this.renderer.setStyle(this.ghostElement, 'border-radius', '4px');
        this.renderer.setStyle(this.ghostElement, 'box-shadow', '0 5px 15px rgba(0,0,0,0.3)');
        this.renderer.setProperty(this.ghostElement, 'innerText', `🗂 Перенос элементов: ${ids.length}`);

        this.renderer.appendChild(document.body, this.ghostElement);
        this.updateGhostPosition();

        this.isDragging.set(true);
        this.disableTextSelection();
    }

    private updateGhostPosition() {
        if (!this.ghostElement) return;
        this.renderer.setStyle(this.ghostElement, 'left', `${this.currentMouseX + 15}px`);
        this.renderer.setStyle(this.ghostElement, 'top', `${this.currentMouseY + 15}px`);
    }

    private calculateDropTarget(event: MouseEvent) {
        const target = event.target as HTMLElement;

        const header = target.closest('.panel-header') as HTMLElement;
        const emptyZone = !header ? (target.closest('.drop-zone') as HTMLElement) : null;
        const element = header || emptyZone;

        if (this.currentTargetElement && this.currentTargetElement !== element) {
            this.clearTargetStyles(this.currentTargetElement);
        }

        this.currentTargetElement = element;
        if (!element) {
            this.currentDropPosition = null;
            return;
        }

        if (emptyZone) {
            const zoneId = emptyZone.dataset['dropZoneId'];
            if (!zoneId || this.dragIds.includes(zoneId) || this.isTargetChildOfDragged(zoneId)) {
                this.renderer.addClass(emptyZone, 'drop-denied');
                this.currentDropPosition = null;
                return;
            }
            this.renderer.addClass(emptyZone, 'drop-inside');
            this.currentDropPosition = 'inside';
            return;
        }

        const targetId = header.dataset['projectId'];
        if (!targetId || this.dragIds.includes(targetId) || this.isTargetChildOfDragged(targetId)) {
            this.currentDropPosition = null;
            this.renderer.addClass(header, 'drop-denied');
            return;
        }

        const rect = header.getBoundingClientRect();
        const relativeY = event.clientY - rect.top;

        if (relativeY < rect.height * 0.3) {
            this.currentDropPosition = 'before';
            this.renderer.removeClass(header, 'drop-after');
            this.renderer.removeClass(header, 'drop-inside');
            this.renderer.addClass(header, 'drop-before');
        } else if (relativeY > rect.height * 0.7) {
            this.currentDropPosition = 'after';
            this.renderer.removeClass(header, 'drop-before');
            this.renderer.removeClass(header, 'drop-inside');
            this.renderer.addClass(header, 'drop-after');
        } else {
            this.currentDropPosition = 'inside';
            this.renderer.removeClass(header, 'drop-before');
            this.renderer.removeClass(header, 'drop-after');
            this.renderer.addClass(header, 'drop-inside');
        }
    }

    private clearTargetStyles(el: HTMLElement) {
        this.renderer.removeClass(el, 'drop-before');
        this.renderer.removeClass(el, 'drop-after');
        this.renderer.removeClass(el, 'drop-inside');
        this.renderer.removeClass(el, 'drop-denied');
    }

    private isTargetChildOfDragged(targetId: string): boolean {
        const map = this.getChildrenMap();
        return this.dragIds.some(dragId => {
            let currentParentId = Object.keys(map).find(pid => map[pid].some(p => p.id === targetId));
            while (currentParentId) {
                if (currentParentId === dragId) return true;
                const nextParent = currentParentId;
                currentParentId = Object.keys(map).find(pid => map[pid].some(p => p.id === nextParent));
            }
            return false;
        });
    }

    private onMouseUp(event: MouseEvent): void {
        const ctrl = event.ctrlKey || event.metaKey;

        if (this.isDragging()) {
            this.finishDrag();
        } else {
            if (!this.mouseMoved) {
                // Если кликнули БЕЗ Ctrl — сбрасываем старый выбор и оставляем активным только текущий узел
                if (!ctrl) {
                    const clickedZone = event.target as HTMLElement;
                    const header = clickedZone.closest('.panel-header') as HTMLElement;
                    const id = header?.dataset['projectId'];
                    if (id) this.selectedIds.set(new Set([id]));
                }

                // Вызываем открытие панели, только если onToggleExpandCallback не занулился из-за Ctrl
                if (this.onToggleExpandCallback) {
                    this.onToggleExpandCallback();
                }
            }
            this.stopPotentialDrag();
        }
    }

    private finishDrag() {
        this.clearGlobalListeners();
        this.enableTextSelection();

        if (this.currentTargetElement) {
            this.clearTargetStyles(this.currentTargetElement);
        }

        this.dragIds.forEach(id => {
            const el = document.querySelector(`[data-project-id="${id}"]`) as HTMLElement;
            if (el) this.renderer.setStyle(el, 'opacity', '1');
        });

        if (this.ghostElement) {
            this.renderer.removeChild(document.body, this.ghostElement);
            this.ghostElement = null;
        }

        if (this.currentTargetElement && this.currentDropPosition) {
            const map = this.getChildrenMap();

            if (this.currentDropPosition === 'inside') {
                const targetParentId = this.currentTargetElement.dataset['projectId'] || this.currentTargetElement.dataset['dropZoneId']!;
                if (this.moveCallback) {
                    this.moveCallback(this.dragIds, targetParentId, undefined, 'inside');
                }
            } else {
                const relativeToId = this.currentTargetElement.dataset['projectId']!; const targetParentId = Object.keys(map).find(pid => map[pid].some(p => p.id === relativeToId)); if (targetParentId && this.moveCallback) { this.moveCallback(this.dragIds, targetParentId, relativeToId, this.currentDropPosition); }
            } this.selectedIds.set(new Set());
        } this.isDragging.set(false); this.potentialDrag = false; this.dragIds = []; this.currentTargetElement = null; this.currentDropPosition = null; this.onToggleExpandCallback = null;
    } private stopPotentialDrag() { this.clearGlobalListeners(); this.potentialDrag = false; this.mouseMoved = false; this.onToggleExpandCallback = null; } private disableTextSelection() { this.renderer.setStyle(document.body, 'user-select', 'none'); this.renderer.setStyle(document.body, '-webkit-user-select', 'none'); } private enableTextSelection() { this.renderer.removeStyle(document.body, 'user-select'); this.renderer.removeStyle(document.body, '-webkit-user-select'); } private clearGlobalListeners() { this.removeGlobalListeners.forEach(fn => fn()); this.removeGlobalListeners = []; }
}