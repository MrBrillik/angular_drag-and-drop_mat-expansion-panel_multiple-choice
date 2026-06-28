import { Injectable, signal, Renderer2, RendererFactory2 } from '@angular/core';
import { Project } from './project.interface';

@Injectable({ providedIn: 'root' })
export class DragDropService {
    readonly selectedIds = signal<Set<string>>(new Set());
    readonly isDragging = signal(false);

    private dragIds: string[] = [];
    private ghostElement: HTMLElement | null = null;
    private userSelectStyle: HTMLStyleElement | null = null;

    moveCallback!: (ids: string[], targetParentId: string) => void;
    getChildrenMap!: () => Record<string, Project[]>;

    private startMouseX = 0;
    private startMouseY = 0;
    private currentMouseX = 0;
    private currentMouseY = 0;
    private mouseMoved = false;
    private potentialDrag = false;
    private currentDropZone: HTMLElement | null = null;

    // Коллбек для открытия папки, если движение мыши не превратилось в перетаскивание
    private onToggleExpandCallback: (() => void) | null = null;

    private renderer: Renderer2;
    private removeGlobalListeners: (() => void)[] = [];

    constructor(rendererFactory: RendererFactory2) {
        this.renderer = rendererFactory.createRenderer(null, null);
    }

    onHeaderMouseDown(event: MouseEvent, projectId: string, toggleExpandFn: () => void): void {
        if (event.button !== 0) return;

        const ctrl = event.ctrlKey || event.metaKey;
        this.onToggleExpandCallback = toggleExpandFn;

        // С логикой выделения:
        if (ctrl) {
            this.toggleSelection(projectId);
        } else {
            // Если элемент уже выбран, не сбрасываем сразу (вдруг пользователь хочет начать тянуть всю группу)
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
        this.selectedIds.update(set => {
            const newSet = new Set(set);
            if (newSet.has(projectId)) newSet.delete(projectId);
            else newSet.add(projectId);
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

        // Порог в 5 пикселей, отделяющий клик от начала перетаскивания
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
            this.highlightDropZone(event);
        }
    }

    private startDrag(ids: string[]) {
        this.dragIds = [...ids];

        // Визуальный кастомный эффект для перетаскиваемых панелей
        ids.forEach(id => {
            const el = document.querySelector(`[data-project-id="${id}"]`) as HTMLElement;
            if (el) this.renderer.setStyle(el, 'opacity', '0.4');
        });

        // Создаем Ghost-элемент
        this.ghostElement = this.renderer.createElement('div');
        this.renderer.setStyle(this.ghostElement, 'position', 'fixed');
        this.renderer.setStyle(this.ghostElement, 'z-index', '9999');
        this.renderer.setStyle(this.ghostElement, 'pointer-events', 'none');
        this.renderer.setStyle(this.ghostElement, 'background', '#1565c0');
        this.renderer.setStyle(this.ghostElement, 'color', 'white');
        this.renderer.setStyle(this.ghostElement, 'padding', '8px 14px');
        this.renderer.setStyle(this.ghostElement, 'border-radius', '4px');
        this.renderer.setStyle(this.ghostElement, 'box-shadow', '0 5px 15px rgba(0,0,0,0.3)');
        this.renderer.setStyle(this.ghostElement, 'font-weight', '500');
        this.renderer.setProperty(this.ghostElement, 'innerText', `🗂 Выбрано элементов: ${ids.length}`);

        this.renderer.appendChild(document.body, this.ghostElement);
        this.updateGhostPosition();

        this.isDragging.set(true);
        this.disableTextSelection();
        this.addDropZoneListeners();
    }

    private updateGhostPosition() {
        if (!this.ghostElement) return;
        this.renderer.setStyle(this.ghostElement, 'left', `${this.currentMouseX + 15}px`);
        this.renderer.setStyle(this.ghostElement, 'top', `${this.currentMouseY + 15}px`);
    }

    private highlightDropZone(event: MouseEvent) {
        const target = event.target as HTMLElement;
        const zone = target.closest('.drop-zone') as HTMLElement;

        if (this.currentDropZone === zone) return;

        if (this.currentDropZone) {
            this.renderer.removeClass(this.currentDropZone, 'drop-allowed');
            this.renderer.removeClass(this.currentDropZone, 'drop-denied');
        }

        this.currentDropZone = zone;
        if (!zone) return;

        const targetId = zone.dataset['dropZoneId'];
        if (!targetId) return;

        if (this.isDropAllowed(targetId)) {
            this.renderer.addClass(zone, 'drop-allowed');
        } else {
            this.renderer.addClass(zone, 'drop-denied');
        }
    }

    private isDropAllowed(targetParentId: string): boolean {
        if (this.dragIds.includes(targetParentId)) return false;
        if (this.dragIds.some(id => this.isAncestor(id, targetParentId))) return false;
        return true;
    }

    private isAncestor(potentialAncestorId: string, currentId: string): boolean {
        const map = this.getChildrenMap();
        let currentParentId = Object.keys(map).find(pid => map[pid].some(p => p.id === currentId));

        while (currentParentId) {
            if (currentParentId === potentialAncestorId) return true;
            const nextParent = currentParentId;
            currentParentId = Object.keys(map).find(pid => map[pid].some(p => p.id === nextParent));
        }
        return false;
    }

    private onMouseUp(event: MouseEvent): void {
        const ctrl = event.ctrlKey || event.metaKey;

        if (this.isDragging()) {
            this.finishDrag();
        } else {
            // Если МЫШКА НЕ ДВИГАЛАСЬ — это чистый клик!
            if (!this.mouseMoved) {
                // Если клик БЕЗ Ctrl — сбрасываем мульти-выбор до текущего элемента
                if (!ctrl) {
                    const clickedZone = event.target as HTMLElement;
                    const header = clickedZone.closest('.panel-header') as HTMLElement;
                    const id = header?.dataset['projectId'];
                    if (id) {
                        this.selectedIds.set(new Set([id]));
                    }
                }
                // Запускаем открытие/закрытие панели
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
        this.removeDropZoneListeners();

        const zone = this.currentDropZone;
        const targetParentId = zone ? zone.dataset['dropZoneId'] : null;

        this.dragIds.forEach(id => {
            const el = document.querySelector(`[data-project-id="${id}"]`) as HTMLElement;
            if (el) this.renderer.setStyle(el, 'opacity', '1');
        });

        if (this.ghostElement) {
            this.renderer.removeChild(document.body, this.ghostElement);
            this.ghostElement = null;
        }

        if (targetParentId && this.isDropAllowed(targetParentId)) {
            if (this.moveCallback) {
                this.moveCallback(this.dragIds, targetParentId);
            }
            this.selectedIds.set(new Set());
        }

        this.isDragging.set(false);
        this.potentialDrag = false;
        this.dragIds = [];
        this.currentDropZone = null;
        this.onToggleExpandCallback = null;
    }

    private stopPotentialDrag() {
        this.clearGlobalListeners();
        this.potentialDrag = false;
        this.mouseMoved = false;
        this.onToggleExpandCallback = null;
    }

    private disableTextSelection() {
        if (this.userSelectStyle) return;
        const style = this.renderer.createElement('style');
        style.innerHTML = `* { user-select: none !important; -webkit-user-select: none !important; }`;
        this.renderer.appendChild(document.head, style);
        this.userSelectStyle = style;
    }

    private enableTextSelection() {
        if (this.userSelectStyle) {
            this.renderer.removeChild(document.head, this.userSelectStyle);
            this.userSelectStyle = null;
        }
    }

    private addDropZoneListeners() {
        document.querySelectorAll('.drop-zone').forEach(zone => {
            this.renderer.addClass(zone, 'drop-zone-active');
        });
    }

    private removeDropZoneListeners() {
        document.querySelectorAll('.drop-zone').forEach(zone => {
            this.renderer.removeClass(zone, 'drop-zone-active');
            this.renderer.removeClass(zone, 'drop-allowed');
            this.renderer.removeClass(zone, 'drop-denied');
        });
    }

    private clearGlobalListeners() {
        this.removeGlobalListeners.forEach(fn => fn());
        this.removeGlobalListeners = [];
    }
}
