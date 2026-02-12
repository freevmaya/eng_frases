<div class="modal fade" tabindex="-1" aria-labelledby="centeredModalLabel" aria-hidden="true" id="message">
    <div class="modal-dialog modal-dialog-centered modal-dialog-scrollable">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id="centeredModalLabel"><?=Lang('attention')?>!</h5>
            </div>
            <div class="modal-body">
                <div class="content" style="height: 320px">
                </div>
            </div>
            <div class="modal-footer">
                <div class="page-buttons">
                    <button type="button" class="btn btn-secondary prev"><i class="bi bi-arrow-left"></i></button>
                    <span class="page-number"></span>
                    <button type="button" class="btn btn-secondary next"><i class="bi bi-arrow-right"></i></button>
                </div>
                <button type="button" class="btn btn-primary" data-bs-dismiss="modal"><?=Lang('got_it')?></button>
            </div>
        </div>
    </div>
</div>